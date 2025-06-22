# EquipTrack DynamoDB Schema

This document outlines the three-table design for the EquipTrack application's database, providing clear separation of concerns and improved maintainability.

## Table 1: `UsersAndOrganizations` (User Management Table)

This table manages users, organizations, and the relationships between them.

-   **Table Name**: `UsersAndOrganizations`
-   **Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

### Entity Map

| Entity / Purpose       | `PK` (Partition Key)      | `SK` (Sort Key)                   |
| :--------------------- | :------------------------ | :-------------------------------- |
| **Organization**       | `ORG#<id>`                | `METADATA`                        |
| **User**               | `USER#<id>`               | `METADATA`                        |
| **User-Org Link**      | `USER#<id>`               | `ORG#<id>`                        |

---

## Table 2: `Inventory` (Inventory Management Table)

This table manages products, inventory items, and their current holders.

-   **Table Name**: `Inventory`
-   **Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

### Global Secondary Indexes (GSIs)

1.  **`ItemsByHolderIndex`**: Used for querying inventory items by their current holder (a user or a warehouse).
    -   **PK**: `holderIdQueryKey` (`HOLDER#<orgId>#<userId>` or `HOLDER#<orgId>#WAREHOUSE`)
    -   **SK**: `SK` (`PRODUCT#<id>#UPI#<upi>` or `PRODUCT#<id>#HOLDER#<holder>`)

2.  **`ProductsByOrganizationIndex`**: Used for querying all product definitions within an organization.
    -   **PK**: `organizationId` (`ORG#<id>`)
    -   **SK**: `SK` (`PRODUCT#<id>`)

### Entity Map

| Entity / Purpose       | `PK` (Partition Key)      | `SK` (Sort Key)                   | `holderIdQueryKey`                    | `organizationId`           |
| :--------------------- | :------------------------ | :-------------------------------- | :----------------------------------- | :-------------------------- |
| **Product Definition** | `ORG#<id>`                | `PRODUCT#<id>`                    | -                                    | `ORG#<id>`                  |
| **Unique Item**        | `ORG#<id>`                | `PRODUCT#<id>#UPI#<upi>`           | `HOLDER#<orgId>#<userId>`             | -                          |
| **Bulk Item Holding**  | `ORG#<id>`                | `PRODUCT#<id>#HOLDER#<holder>`    | `HOLDER#<orgId>#<userId>`             | -                          |

---

## Table 3: `Forms` (Forms Management Table)

This table manages check-in/check-out forms and predefined forms.

-   **Table Name**: `Forms`
-   **Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

### Global Secondary Indexes (GSIs)

1.  **`FormsByOrganizationIndex`**: Used for querying all forms within an organization.
    -   **PK**: `organizationId` (`ORG#<id>`)
    -   **SK**: `SK` (`FORM#<id>`)

### Entity Map

| Entity / Purpose       | `PK` (Partition Key)      | `SK` (Sort Key)                   | `organizationId`           |
| :--------------------- | :------------------------ | :-------------------------------- | :-------------------------- |
| **User Form**          | `USER#<id>`               | `FORM#<id>`                       | `ORG#<id>`                  |
| **Predefined Form**    | `ORG#<id>`                | `FORM#<id>`                       | `ORG#<id>`                  |

---

## Table 4: `EquipTrackReport` (OLAP Table)

This is the Online Analytical Processing (OLAP) table. Its purpose is to store a daily snapshot of the state of all inventory items for historical reporting. It is designed to be write-heavy and can grow very large without impacting the performance of the main application tables.

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