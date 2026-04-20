#!/usr/bin/env bash
# Connect a preview hostname (e.g. pr-preview.equip-track.com) to your EC2 using AWS CLI.
#
# Prerequisites: aws CLI v2, jq (for Route 53 JSON). IAM: ec2:AllocateAddress/AssociateAddress (eip);
#   route53:ChangeResourceRecordSets, route53:ListHostedZones, route53:GetHostedZone (route53).
#
# Typical flow:
#   1) Allocate + associate an Elastic IP to the preview instance (stable target for DNS):
#        AWS_REGION=il-central-1 ./scripts/preview-setup-public-dns.sh elastic-ip-associate --instance-id i-0abc...
#   2) Point the subdomain A record at that IP (Route 53 hosted zone for equip-track.com must exist):
#        ./scripts/preview-setup-public-dns.sh route53-a-upsert \
#          --zone-name equip-track.com \
#          --record-name pr-preview.equip-track.com \
#          --ip 1.2.3.4
#
# Security group on the instance must allow inbound 80/443 (and 22 for SSH) from the internet or ALB as you design.
# TLS: terminate at ALB (ACM) or on-host; this script only sets DNS → instance IP.
#
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: preview-setup-public-dns.sh <command> [options]

Commands:
  elastic-ip-associate   Allocate a VPC Elastic IP and associate it to an EC2 instance.
  route53-a-upsert       Create or update an A record in Route 53.

Global options (env):
  AWS_PROFILE, AWS_REGION (default for EC2: il-central-1 to match pr-preview-ec2-power workflow)

Examples:
  AWS_REGION=il-central-1 ./scripts/preview-setup-public-dns.sh elastic-ip-associate --instance-id i-0123456789abcdef0

  ./scripts/preview-setup-public-dns.sh route53-a-upsert \\
    --zone-name equip-track.com \\
    --record-name pr-preview.equip-track.com \\
    --ip 203.0.113.50

  ./scripts/preview-setup-public-dns.sh route53-a-upsert \\
    --hosted-zone-id Z1234567890ABC \\
    --record-name pr-preview.equip-track.com \\
    --ip 203.0.113.50
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

require_aws() {
  command -v aws >/dev/null 2>&1 || die "aws CLI not found. Install: https://docs.aws.amazon.com/cli/"
  aws sts get-caller-identity >/dev/null || die "AWS credentials not configured (aws sts get-caller-identity failed)."
}

normalize_fqdn() {
  local n="$1"
  if [[ "${n}" != *. ]]; then
    printf '%s.' "${n}"
  else
    printf '%s' "${n}"
  fi
}

cmd_elastic_ip_associate() {
  require_aws
  local instance_id="" region="${AWS_REGION:-il-central-1}"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --instance-id)
        instance_id="${2:?}"
        shift 2
        ;;
      --region)
        region="${2:?}"
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done
  [[ -n "${instance_id}" ]] || die "--instance-id is required"

  echo "Allocating Elastic IP in ${region}..."
  local alloc_id
  alloc_id="$(aws ec2 allocate-address --domain vpc --region "${region}" --query AllocationId --output text)"
  [[ -n "${alloc_id}" && "${alloc_id}" != None ]] || die "allocate-address failed"

  echo "Associating ${alloc_id} to instance ${instance_id}..."
  aws ec2 associate-address \
    --instance-id "${instance_id}" \
    --allocation-id "${alloc_id}" \
    --region "${region}" \
    >/dev/null

  local public_ip
  public_ip="$(aws ec2 describe-addresses --allocation-ids "${alloc_id}" --region "${region}" --query 'Addresses[0].PublicIp' --output text)"
  echo "Elastic IP associated: ${public_ip}"
  echo "Next: create/update DNS (Route 53) to point pr-preview.equip-track.com at this IP, e.g.:"
  echo "  ./scripts/preview-setup-public-dns.sh route53-a-upsert --zone-name equip-track.com --record-name pr-preview.equip-track.com --ip ${public_ip}"
}

hosted_zone_id_from_name() {
  local zone_name
  zone_name="$(normalize_fqdn "$1")"
  local id
  id="$(aws route53 list-hosted-zones-by-name --dns-name "${zone_name}" --query 'HostedZones[0].Id' --output text 2>/dev/null || true)"
  if [[ -z "${id}" || "${id}" == None ]]; then
    die "Could not find hosted zone for '${zone_name}'. Create the zone in Route 53 first or pass --hosted-zone-id."
  fi
  # Id looks like /hostedzone/Z123...
  printf '%s' "${id##*/}"
}

cmd_route53_a_upsert() {
  require_aws
  command -v jq >/dev/null 2>&1 || die "jq is required for route53-a-upsert (brew install jq)"
  local zone_name="" zone_id="" record_name="" ip="" ttl=300 dry_run=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --zone-name)
        zone_name="${2:?}"
        shift 2
        ;;
      --hosted-zone-id)
        zone_id="${2:?}"
        shift 2
        ;;
      --record-name)
        record_name="${2:?}"
        shift 2
        ;;
      --ip)
        ip="${2:?}"
        shift 2
        ;;
      --ttl)
        ttl="${2:?}"
        shift 2
        ;;
      --dry-run)
        dry_run=1
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done

  [[ -n "${ip}" ]] || die "--ip is required"
  [[ -n "${record_name}" ]] || die "--record-name is required (e.g. pr-preview.equip-track.com)"

  if [[ -n "${zone_id}" ]]; then
    :
  elif [[ -n "${zone_name}" ]]; then
    zone_id="$(hosted_zone_id_from_name "${zone_name}")"
  else
    die "Provide either --zone-name (e.g. equip-track.com) or --hosted-zone-id Z..."
  fi

  local fqdn
  fqdn="$(normalize_fqdn "${record_name}")"

  local batch
  batch="$(jq -nc \
    --arg name "${fqdn}" \
    --arg ip "${ip}" \
    --argjson ttl "${ttl}" \
    '{Changes:[{Action:"UPSERT",ResourceRecordSet:{Name:$name,Type:"A",TTL:$ttl,ResourceRecords:[{Value:$ip}]}}]}')"

  if [[ "${dry_run}" -eq 1 ]]; then
    echo "Hosted zone ID: ${zone_id}"
    echo "Change batch:"
    jq . <<<"${batch}"
    exit 0
  fi

  echo "Upserting A record ${fqdn} -> ${ip} (TTL ${ttl}s) in zone ${zone_id}..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id "${zone_id}" \
    --change-batch "${batch}" \
    --output text \
    --query 'ChangeInfo.Id'

  echo "DNS change submitted. Propagation may take a few minutes. Test: dig +short ${record_name} A"
}

main() {
  local sub="${1:-}"
  shift || true
  case "${sub}" in
    elastic-ip-associate)
      cmd_elastic_ip_associate "$@"
      ;;
    route53-a-upsert)
      cmd_route53_a_upsert "$@"
      ;;
    -h | --help | help | "")
      usage
      [[ -n "${sub}" ]] || exit 0
      exit 0
      ;;
    *)
      die "unknown command: ${sub} (run with --help)"
      ;;
  esac
}

main "$@"
