# EquipTrack DynamoDB Schema

This document outlines the final, two-table design for the EquipTrack application's database, utilizing a single-table design pattern with semantic naming for clarity and maintainability.

## Table 1: `EquipTrack` (Main OLTP Table)

This is the core Online Transaction Processing (OLTP) table. It holds the current state of all primary application entities. It is designed for fast, efficient reads and writes for the day-to-day operations of the application.

-   **Table Name**: `EquipTrack`
-   **Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

### Global Secondary Indexes (GSIs)

1.  **`ItemsByHolderIndex`**: Used for querying inventory items by their current holder (a user or a warehouse).
    -   **GSI1PK**: `PK` (`ORG#<id>`)
    -   **GSI1SK**: `holderId` (`HOLDER#<userId>` or `HOLDER#WAREHOUSE`)
2.  **`OrganizationToUsersIndex`**: Used for finding all users within an organization - reversed PK.
    -   **GSI2PK**: `organizationToUserQueryKey` (`ORG#<id>`) - new field to not index all other items
    -   **GSI2SK**: `PK` (`USER#<id>`)
3.  **`TransactionsIndex`**: Use for querying transactions By userId and organizationId.
    -   **GSI3PK**: `transactionQueryKey` (`USER#<userId>#TRANSACTIONS`)
    -   **GSI3SK**: `SK` (`TRANSFER#<id>`)

### Entity Map

This table uses the "adjacency list" pattern, where multiple entity types are stored in the same table. The `PK` and `SK` format for each entity is detailed below.

| Entity / Purpose       | `PK` (Partition Key)      | `SK` (Sort Key)                   | `holderId` (GSI1SK)           | `organizationToUserQueryKey` (GSI2PK) | `transactionQueryKey` (GSI3PK) |
| :--------------------- | :------------------------ | :-------------------------------- | :---------------------------- | :------------------------------------ | :----------------------------- |
| **Organization**       | `ORG#<id>`                | `METADATA`                        | -                             | -                                     | -                              |
| **User**               | `USER#<id>`               | `METADATA`                        | -                             | -                                     | -                              |
| **User-Org Link**      | `USER#<id>`               | `ORG#<id>`                        | -                             | `ORG#<id>`                            | -                              |
| **Product Definition** | `ORG#<id>`                | `PRODUCT#<id>`                    | -                             | -                                     | -                              |
| **Unique Item**        | `ORG#<id>`                | `PRODUCT#<id>#UPI#<upi>`           | `HOLDER#<id>`                 | -                                     | -                              |
| **Bulk Item Holding**  | `ORG#<id>`                | `PRODUCT#<id>#HOLDER#<holder>`    | `HOLDER#<id>`                 | -                                     | -                              |
| **Pending Transfer**   | `ORG#<id>`                | `TRANSFER#<id>`                   | -                             | -                                     | `USER#<userId>#TRANSACTIONS`   |

---

## Table 2: `EquipTrackReport` (OLAP Table)

This is the Online Analytical Processing (OLAP) table. Its purpose is to store a daily snapshot of the state of all inventory items for historical reporting. It is designed to be write-heavy and can grow very large without impacting the performance of the main application table.

Instead of storing a single large document per day (which risks hitting DynamoDB's 400KB item size limit), this table stores **one row per reported item, per day**.

-   **Table Name**: `EquipTrackReports`

### Primary Key and GSI

-   **Primary Key**: `orgDailyReportId` (Composite Partition Key)
-   **Primary Sort Key**: `itemKey`
-   **GSI 1 (`ItemReportHistoryIndex`)**: Used to query the entire history of a single item across all reports.
    -   **GSI1PK**: `itemOrgKey`
    -   **GSI1SK**: `reportDate`

### Schema Definition

| Attribute Name     | Example Value                                  | Description                                                        |
| :----------------- | :--------------------------------------------- | :----------------------------------------------------------------- |
| `orgDailyReportId` | `ORG#123#DATE#2023-10-28`                        | **Partition Key**. Groups all items for one org's daily report.    |
| `itemKey`          | `PRODUCT#Laptop#UPI#XYZ-123`                     | **Sort Key**. Uniquely identifies the item within the daily report.  |
| `itemOrgKey`       | `ORG#123#ITEM_KEY#PRODUCT#Laptop#UPI#XYZ-123`    | **GSI1PK**. For querying the full history of a single item.        |
| `reportDate`       | `2023-10-28`                                   | **GSI1SK**. For sorting an item's history chronologically.         |
| `location`         | `USER#456`                                     | The location/holder of the item on this specific day.              |
| ...                | ...                                            | Other relevant report data can be added as needed.                 | 