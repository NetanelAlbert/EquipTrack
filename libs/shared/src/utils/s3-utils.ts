const PRESIGNED_URL_REGEX =
  /equip-track-forms\.s3\.[\w-]+\.amazonaws\.com\/.*X-Amz-Expires=(\d+)/;
export function getPresignedUrlTTL(url: string): number | undefined {
  const match = url.match(PRESIGNED_URL_REGEX);
  if (!match) {
    return undefined;
  }
  const ttl = parseInt(match[1]);
  return ttl;
}
