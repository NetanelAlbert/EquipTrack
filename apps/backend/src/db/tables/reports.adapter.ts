import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  REPORT_TABLE_NAME,
  ITEM_REPORT_HISTORY_INDEX,
  ORG_PREFIX,
  PRODUCT_PREFIX,
  UPI_PREFIX,
  DATE_PREFIX,
  ITEM_KEY_PREFIX,
  BATCH_WRITE_SIZE,
} from '../constants';
import { ItemReport } from '@equip-track/shared';

export interface ReportItem extends ItemReport {
  orgDailyReportId: string; // PK: ORG#<id>#DATE#<date>
  itemKey: string; // SK: PRODUCT#<id>#UPI#<upi>
  itemOrgKey: string; // GSI1PK: ORG#<id>#ITEM_KEY#PRODUCT#<id>#UPI#<upi>
  reportDate: string; // GSI1SK: YYYY-MM-DD
}

export class ReportsAdapter {
  private readonly client = new DynamoDBClient({});
  private readonly docClient = DynamoDBDocumentClient.from(this.client);
  private readonly tableName = REPORT_TABLE_NAME;

  async getReportsByDates(
    organizationId: string,
    dates: string[]
  ): Promise<ReportItem[]> {
    const allReports: ReportItem[] = [];

    for (const date of dates) {
      const orgDailyReportId = `${ORG_PREFIX}${organizationId}#${DATE_PREFIX}${date}`;

      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'orgDailyReportId = :orgDailyReportId',
          ExpressionAttributeValues: {
            ':orgDailyReportId': orgDailyReportId,
          },
        })
      );

      if (result.Items) {
        allReports.push(...(result.Items as ReportItem[]));
      }
    }

    return allReports;
  }

  private prepareReportItems(
    organizationId: string,
    date: string,
    items: ItemReport[]
  ): ReportItem[] {
    const orgDailyReportId = `${ORG_PREFIX}${organizationId}#${DATE_PREFIX}${date}`;
    const now = Date.now();

    return items.map((item) => {
      const { productId, upi } = item;
      const itemKey = `${PRODUCT_PREFIX}${productId}#${UPI_PREFIX}${upi}`;
      const itemOrgKey = `${ORG_PREFIX}${organizationId}#${ITEM_KEY_PREFIX}${itemKey}`;
      const reportedAt = item.reportedAt || now;

      return {
        orgDailyReportId,
        itemKey,
        itemOrgKey,
        reportDate: date,
        ...item,
        reportedAt,
      };
    });
  }

  private async processBatch(batch: ReportItem[]): Promise<number> {
    try {
      const result = await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((item) => ({
              PutRequest: {
                Item: item,
              },
            })),
          },
        })
      );

      let processedCount = batch.length;

      // Handle any unprocessed items (due to throttling or other issues)
      if (result.UnprocessedItems && result.UnprocessedItems[this.tableName]) {
        const unprocessedRequests = result.UnprocessedItems[this.tableName];
        console.warn(
          `Retrying ${unprocessedRequests.length} unprocessed items individually...`
        );

        processedCount = await this.retryUnprocessedItems(unprocessedRequests);
      }

      return processedCount;
    } catch (error) {
      console.error('Failed to process batch:', error);
      return await this.fallbackToIndividualOperations(batch);
    }
  }

  private async retryUnprocessedItems(
    unprocessedRequests: any[]
  ): Promise<number> {
    let successCount = 0;

    for (const request of unprocessedRequests) {
      if (request.PutRequest) {
        try {
          await this.docClient.send(
            new PutCommand({
              TableName: this.tableName,
              Item: request.PutRequest.Item,
            })
          );
          successCount++;
        } catch (error) {
          console.error('Failed to retry individual item:', error);
        }
      }
    }

    return successCount;
  }

  private async fallbackToIndividualOperations(
    batch: ReportItem[]
  ): Promise<number> {
    let successCount = 0;

    for (const item of batch) {
      try {
        await this.docClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: item,
          })
        );
        successCount++;
      } catch (error) {
        console.error(`Failed to publish report item ${item.itemKey}:`, error);
      }
    }

    return successCount;
  }

  async publishPartialReport(
    organizationId: string,
    date: string,
    items: ItemReport[]
  ): Promise<number> {
    const reportItems = this.prepareReportItems(organizationId, date, items);
    let publishedCount = 0;

    // Process items in batches of 25 (DynamoDB BatchWrite limit)
    const batchSize = BATCH_WRITE_SIZE;
    for (let i = 0; i < reportItems.length; i += batchSize) {
      const batch = reportItems.slice(i, i + batchSize);
      publishedCount += await this.processBatch(batch);
    }

    return publishedCount;
  }

  async getItemHistory(
    organizationId: string,
    productId: string,
    upi: string
  ): Promise<ReportItem[]> {
    const itemKey = `${PRODUCT_PREFIX}${productId}#${UPI_PREFIX}${upi}`;
    const itemOrgKey = `${ORG_PREFIX}${organizationId}#${ITEM_KEY_PREFIX}${itemKey}`;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: ITEM_REPORT_HISTORY_INDEX,
        KeyConditionExpression: 'itemOrgKey = :itemOrgKey',
        ExpressionAttributeValues: {
          ':itemOrgKey': itemOrgKey,
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    return (result.Items || []) as ReportItem[];
  }

  async getDailyReport(
    organizationId: string,
    date: string
  ): Promise<ReportItem[]> {
    const orgDailyReportId = `${ORG_PREFIX}${organizationId}#${DATE_PREFIX}${date}`;

    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'orgDailyReportId = :orgDailyReportId',
        ExpressionAttributeValues: {
          ':orgDailyReportId': orgDailyReportId,
        },
      })
    );

    return (result.Items || []) as ReportItem[];
  }
}
