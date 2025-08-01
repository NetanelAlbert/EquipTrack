import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private readonly client: S3Client;
  private readonly bucketName = 'equip-track-forms';

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Uploads a PDF file to S3 with organized folder structure
   * @param buffer PDF file buffer
   * @param organizationId Organization ID for folder structure
   * @param formType Form type (check-in or check-out)
   * @param userId User ID for folder structure
   * @param formId Form ID for filename
   * @returns S3 URL of uploaded file
   */
  async uploadFormPDF(
    buffer: Buffer,
    organizationId: string,
    formType: string,
    userId: string,
    formId: string
  ): Promise<string> {
    const stage = process.env.STAGE || 'dev';

    // Create organized folder structure: {STAGE}/{organizationId}/{formType}/{formId}.pdf
    const key = `${stage}/${organizationId}/${userId}/${formType}/${formId}.pdf`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="${formId}.pdf"`,
      // Add metadata for better organization
      Metadata: {
        organizationId,
        formType,
        formId,
        stage,
        uploadedAt: new Date().toISOString(),
      },
    });

    try {
      await this.client.send(command);

      // Return the S3 URL for the uploaded file
      const region = process.env.AWS_REGION || 'us-east-1';
      const s3Url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;

      return s3Url;
    } catch (error) {
      console.error('Error uploading PDF to S3:', error);
      throw new Error(
        `Failed to upload PDF to S3: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }


  /**
   * Generates a pre-signed URL for accessing the PDF
   * @param url S3 URL of the file
   * @param expiresIn Expiration time in seconds (default: 3600 seconds - 1 hour)
   * @returns Presigned URL
   */
  async getPresignedUrl(url: string, expiresIn = 3600): Promise<string> {
    const key = url.split('amazonaws.com/').pop();
    if (!key) {
      throw new Error('Invalid S3 URL');
    }
    return this.getPresignedUrlFromKey(key, expiresIn);
  }

  /**
   * Generates a pre-signed URL for accessing the PDF (optional enhancement)
   * This could be used if direct S3 URLs don't work due to bucket policies
   * @param key S3 key of the file
   * @param expiresIn Expiration time in seconds (default: 3600 seconds - 1 hour)
   * @returns Presigned URL
   */
  async getPresignedUrlFromKey(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }
}
