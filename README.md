# EquipTrack

EquipTrack is an internal application designed to monitor the supply and location of organizational equipment.

## App goals

### From the users' perspective:

1. Check equipment in and out.
2. Report the location of critical equipment.
3. View all the equipment they have checked out.

### From the warehouse's perspective:

1. Add or remove items from inventory.
2. Track the inventory.
3. Generate a check-out form for specific equipment for a specific user and obtain their signature.
4. Use a pre defined check-out forms.
5. Check in items returned by users.
6. Notify users with daily reports.
7. Generate reports on equipment status.
8. Look up a specific item to see who checked it out.
9. View the check-out history of an item.
10. View the report history of an item.

### From admin prespective:

1. Create and delete users.
2. Assign users warehouse role.


## Product types
The app will manage two types of products:

**Products without Unique Product Identifiers (UPI)**:

- Users can check out multiple items simultaneously.

**Products with Unique Product Identifiers (UPI)**:

- Each item must be checked out individually.
- Users will be assigned specific items.
- Users required to report their status daily.


## Develop stack
- **Frontend:** Angular
- **Backend:** Node.js
- **Compute:** AWS EC2 / EKS
- **Database:** DynamoDB
