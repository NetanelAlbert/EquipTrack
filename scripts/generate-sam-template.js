#!/usr/bin/env node
/**
 * Generates infra/sam/template.yaml from libs/shared endpoint definitions.
 * Keeps API topology in version control (issue #67, SAM option).
 */
const fs = require('fs');
const path = require('path');

const { loadEndpointMetas } = require('./prepare-deployment');

function handlerKeyToLogicalId(handlerKey) {
  return `Lambda${handlerKey.replace(/[^a-zA-Z0-9]/g, '')}`;
}

const OUT = path.join(__dirname, '..', 'infra', 'sam', 'template.yaml');

const CORS_HEADERS =
  "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With";

function methodToOpenApiKey(method) {
  return String(method).toLowerCase();
}

function buildPathsByKey(endpointMetas) {
  /** @type {Record<string, Record<string, { handlerKey: string }>>} */
  const paths = {};
  for (const handlerKey of Object.keys(endpointMetas)) {
    const meta = endpointMetas[handlerKey];
    const p = meta.path;
    const m = methodToOpenApiKey(meta.method);
    if (!paths[p]) paths[p] = {};
    if (paths[p][m]) {
      throw new Error(
        `Duplicate route ${m.toUpperCase()} ${p} (${paths[p][m].handlerKey} vs ${handlerKey})`
      );
    }
    paths[p][m] = { handlerKey };
  }
  return paths;
}

function yamlIndent(lines, spaces) {
  const pad = ' '.repeat(spaces);
  return lines.map((l) => (l ? `${pad}${l}` : '')).join('\n');
}

function emitDefinitionPaths(pathsByKey) {
  const pathKeys = Object.keys(pathsByKey).sort();
  const blocks = [];
  for (const routePath of pathKeys) {
    const methods = pathsByKey[routePath];
    const methodKeys = Object.keys(methods).sort();
    const methodBlocks = [];
    for (const m of methodKeys) {
      const { handlerKey } = methods[m];
      const lambdaLogical = handlerKeyToLogicalId(handlerKey);
      methodBlocks.push(
        [
          `${m}:`,
          `  x-amazon-apigateway-integration:`,
          `    type: aws_proxy`,
          `    httpMethod: POST`,
          `    uri:`,
          `      Fn::Sub:`,
          `        - arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${LambdaArn}/invocations`,
          `        - LambdaArn: !GetAtt ${lambdaLogical}.Arn`,
          `  responses:`,
          `    default:`,
          `      description: Default response`,
        ].join('\n')
      );
    }
    blocks.push(`${routePath}:\n${yamlIndent(methodBlocks.join('\n\n').split('\n'), 2)}`);
  }
  return blocks.join('\n');
}

function emitLambdaPermissions(handlerKeys) {
  const sorted = [...handlerKeys].sort();
  return sorted
    .map((handlerKey) => {
      const logical = `LambdaInvoke${handlerKey.replace(/[^a-zA-Z0-9]/g, '')}`;
      return [
        `  ${logical}:`,
        `    Type: AWS::Lambda::Permission`,
        `    Properties:`,
        `      FunctionName: !Ref ${handlerKeyToLogicalId(handlerKey)}`,
        `      Action: lambda:InvokeFunction`,
        `      Principal: apigateway.amazonaws.com`,
        `      SourceArn: !Sub 'arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${EquipTrackApi}/*/*'`,
      ].join('\n');
    })
    .join('\n');
}

/**
 * IAM policy for DynamoDB / Secrets Manager / forms bucket — ARNs use !Sub for region/account.
 */
function emitLambdaDataPolicyYaml() {
  return [
    '            Version: "2012-10-17"',
    '            Statement:',
    '              - Effect: Allow',
    '                Action:',
    '                  - dynamodb:GetItem',
    '                  - dynamodb:PutItem',
    '                  - dynamodb:Query',
    '                  - dynamodb:Scan',
    '                  - dynamodb:UpdateItem',
    '                  - dynamodb:DeleteItem',
    '                  - dynamodb:BatchGetItem',
    '                  - dynamodb:BatchWriteItem',
    '                Resource:',
    "                  - !Sub 'arn:aws:dynamodb:\${AWS::Region}:*:table/UsersAndOrganizations*'",
    "                  - !Sub 'arn:aws:dynamodb:\${AWS::Region}:*:table/Inventory*'",
    "                  - !Sub 'arn:aws:dynamodb:\${AWS::Region}:*:table/Forms*'",
    "                  - !Sub 'arn:aws:dynamodb:\${AWS::Region}:*:table/EquipTrackReport*'",
    "                  - !Sub 'arn:aws:dynamodb:\${AWS::Region}:*:table/*/index/*'",
    '              - Effect: Allow',
    '                Action:',
    '                  - secretsmanager:GetSecretValue',
    '                Resource:',
    "                  - !Sub 'arn:aws:secretsmanager:\${AWS::Region}:*:secret:equip-track/jwt-private-key*'",
    "                  - !Sub 'arn:aws:secretsmanager:\${AWS::Region}:*:secret:equip-track/jwt-public-key*'",
    '              - Effect: Allow',
    '                Action:',
    '                  - s3:PutObject',
    '                  - s3:GetObject',
    '                  - s3:DeleteObject',
    '                Resource:',
    '                  - arn:aws:s3:::equip-track-forms/*',
    "                  - !Sub 'arn:aws:s3:::equip-track-forms-\${Stage}/*'",
  ].join('\n');
}

function emitEquipTrackLambdaRole() {
  return [
    '  EquipTrackLambdaRole:',
    '    Type: AWS::IAM::Role',
    '    Properties:',
    '      AssumeRolePolicyDocument:',
    "        Version: '2012-10-17'",
    '        Statement:',
    '          - Effect: Allow',
    '            Principal:',
    '              Service: lambda.amazonaws.com',
    '            Action: sts:AssumeRole',
    '      ManagedPolicyArns:',
    '        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    '      Policies:',
    '        - PolicyName: EquipTrackLambdaDataAccess',
    '          PolicyDocument:',
    emitLambdaDataPolicyYaml(),
  ].join('\n');
}

function emitLambdaFunctions(handlerKeys) {
  const sorted = [...handlerKeys].sort();
  return sorted
    .map((handlerKey) => {
      const logical = handlerKeyToLogicalId(handlerKey);
      return [
        `  ${logical}:`,
        '    Type: AWS::Serverless::Function',
        '    Properties:',
        '      Handler: index.handler',
        '      Runtime: nodejs20.x',
        '      Timeout: 30',
        '      MemorySize: 256',
        '      CodeUri:',
        '        Bucket: !Ref LambdaCodeBucketName',
        '        Key: !Ref LambdaCodeS3Key',
        '      Role: !GetAtt EquipTrackLambdaRole.Arn',
        '      Environment:',
        '        Variables:',
        '          STAGE: !Ref Stage',
        `          LAMBDA_HANDLER_KEY: '${handlerKey}'`,
        '          E2E_AUTH_ENABLED: !Ref E2eAuthEnabled',
        '          E2E_AUTH_SECRET: !Ref E2eAuthSecret',
        '',
      ].join('\n');
    })
    .join('\n');
}

function generateTemplate() {
  const endpointMetas = loadEndpointMetas();
  const handlerKeys = Object.keys(endpointMetas);
  const pathsByKey = buildPathsByKey(endpointMetas);
  const pathsYaml = emitDefinitionPaths(pathsByKey);
  const permissionsYaml = emitLambdaPermissions(handlerKeys);

  const header = `# Auto-generated by scripts/generate-sam-template.js — do not edit by hand.
# Regenerate: node scripts/generate-sam-template.js
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: EquipTrack REST API (API Gateway), Lambda invoke permissions, optional custom domain — topology from libs/shared/src/api/endpoints.ts

Parameters:
  Stage:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - production
    Description: Deployment stage (matches STAGE in deploy scripts)
  CertificateArn:
    Type: String
    Default: ''
    Description: ACM certificate ARN in the API region for REGIONAL custom domain; leave empty to skip domain resources in this stack (use setup-api-custom-domain.js instead)
  ApiHostname:
    Type: String
    Default: ''
    Description: API hostname (e.g. dev-api.equip-track.com); required with CertificateArn for custom domain in stack
  LambdaCodeBucketName:
    Type: String
    Description: S3 bucket containing the shared Lambda zip (upload before sam deploy)
  LambdaCodeS3Key:
    Type: String
    Description: S3 object key for shared-lambda-bundle.zip (use content hash in key so updates trigger stack changes)
  E2eAuthEnabled:
    Type: String
    Default: 'false'
    AllowedValues:
      - 'true'
      - 'false'
    Description: When true, sets E2E_AUTH_* on all handler Lambdas (dev E2E login)
  E2eAuthSecret:
    Type: String
    Default: ''
    NoEcho: true
    Description: E2E auth secret when E2eAuthEnabled is true

Conditions:
  HasCustomDomain:
    Fn::And:
      - Fn::Not:
          - Fn::Equals:
              - !Ref CertificateArn
              - ''
      - Fn::Not:
          - Fn::Equals:
              - !Ref ApiHostname
              - ''
Resources:
${emitEquipTrackLambdaRole()}

${emitLambdaFunctions(handlerKeys)}

  EquipTrackApi:
    Type: AWS::Serverless::Api
    Properties:
      Name: !Sub 'equip-track-api-\${Stage}'
      StageName: !Ref Stage
      EndpointConfiguration: REGIONAL
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'${CORS_HEADERS}'"
        AllowOrigin: "'*'"
        AllowCredentials: false
        MaxAge: "'86400'"
      DefinitionBody:
        openapi: 3.0.1
        info:
          title: !Sub 'EquipTrack API \${Stage}'
          version: 1.0.0
        paths:
`;

  const footer = `
  ApiCustomDomain:
    Type: AWS::ApiGateway::DomainName
    Condition: HasCustomDomain
    Properties:
      DomainName: !Ref ApiHostname
      RegionalCertificateArn: !Ref CertificateArn
      EndpointConfiguration:
        Types:
          - REGIONAL
      SecurityPolicy: TLS_1_2

  ApiBasePathMapping:
    Type: AWS::ApiGateway::BasePathMapping
    Condition: HasCustomDomain
    DependsOn: EquipTrackApiStage
    Properties:
      DomainName: !Ref ApiCustomDomain
      RestApiId: !Ref EquipTrackApi
      Stage: !Ref Stage

Outputs:
  RestApiId:
    Description: API Gateway REST API ID
    Value: !Ref EquipTrackApi
  ApiUrl:
    Description: Default execute-api URL for this stage
    Value: !Sub 'https://\${EquipTrackApi}.execute-api.\${AWS::Region}.amazonaws.com/\${Stage}'
  CustomDomainUrl:
    Condition: HasCustomDomain
    Description: HTTPS URL when custom domain is managed by this stack
    Value: !Sub 'https://\${ApiHostname}'
`;

  const body =
    header +
    yamlIndent(pathsYaml.split('\n'), 10).replace(/^\s+$/gm, '') +
    '\n' +
    permissionsYaml +
    footer;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body, 'utf8');
  console.log(`✅ Wrote ${OUT} (${handlerKeys.length} handlers, ${Object.keys(pathsByKey).length} paths)`);
}

if (require.main === module) {
  try {
    generateTemplate();
  } catch (e) {
    console.error('❌ generate-sam-template failed:', e.message);
    process.exit(1);
  }
}

module.exports = { generateTemplate, buildPathsByKey, handlerKeyToLogicalId };
