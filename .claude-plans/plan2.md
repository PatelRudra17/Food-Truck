==================================================
VEGETABLE STORAGE TEMPERATURE MANAGEMENT
==================================================

Implement storage-condition management for every vegetable/item.

Vegetable Master must support:

- Recommended minimum storage temperature
- Recommended maximum storage temperature
- Recommended temperature range
- Storage location
- Storage type
- Shelf life
- Expected shelf-life days
- Temperature-sensitive flag

Example:

Tomato
Recommended Temperature: 10°C - 15°C
Storage Location: Cold Room A
Shelf Life: 7 Days

Create a Storage Monitoring section.

Track:

- Vegetable/Item
- Batch ID
- Warehouse
- Storage location
- Current temperature
- Recorded temperature
- Date/time
- Recorded by
- Temperature status

Temperature status:

NORMAL
WARNING
CRITICAL

Automatically compare the recorded/current temperature with the vegetable's configured acceptable range.

Example:

Required: 10°C - 15°C
Current: 13°C
Status: NORMAL

Required: 10°C - 15°C
Current: 18°C
Status: WARNING/CRITICAL according to configured thresholds.

Dashboard should display:

- Current storage conditions
- Temperature alerts
- Vegetables outside recommended temperature
- Batches at risk
- Storage location temperature status

Create alerts when temperature goes outside the configured range.

Allow authorized users to:

- Configure temperature requirements
- Record temperature manually
- View temperature history
- Filter by warehouse/location/item/batch/date
- Export temperature reports

If IoT/temperature sensors are added in the future, design the database/API so sensor data can be integrated without rebuilding the system.

Do not claim real-time sensor monitoring unless actual hardware/API integration is configured.

==================================================
FLEET FUEL MANAGEMENT
==================================================

Implement complete vehicle fuel management.

For every vehicle maintain:

- Vehicle ID
- Vehicle Number
- Fuel Type
- Current/Odometer KM
- Fuel efficiency target
- Fuel cost per KM
- Total fuel consumed
- Total fuel cost
- Average mileage

Create Fuel Entry functionality.

Fuel Entry fields:

- Fuel Entry ID
- Vehicle
- Date
- Time
- Driver
- Trip ID if applicable
- Fuel station/vendor
- Fuel type
- Previous odometer reading
- Current odometer reading
- Distance travelled
- Fuel quantity
- Fuel rate
- Total fuel cost
- Receipt/invoice attachment
- Remarks
- Entered by

Automatically calculate:

Distance:
Current KM - Previous KM

Fuel Cost:
Fuel Quantity × Fuel Rate

Fuel Cost/KM:
Total Fuel Cost ÷ Distance

Mileage:
Distance ÷ Fuel Quantity

Example:

Previous KM: 20,000
Current KM: 20,500
Distance: 500 KM

Fuel: 50 L
Fuel Rate: ₹95/L

Fuel Cost: ₹4,750
Mileage: 10 KM/L
Fuel Cost/KM: ₹9.50

Create vehicle-wise fuel history.

Dashboard should show:

- Total fuel consumed
- Total fuel cost
- Average mileage
- Average fuel cost/KM
- Highest fuel-consuming vehicles
- Vehicles with abnormal mileage
- Monthly fuel expense
- Fuel expense by vehicle
- Fuel expense by trip

Create filters:

- Vehicle
- Driver
- Fuel type
- Date range
- Trip
- Fuel station

Create reports:

- Vehicle Fuel Report
- Monthly Fuel Cost Report
- Fuel Consumption Report
- Mileage Report
- Fuel Cost/KM Report
- Driver/Trip Fuel Report

Add anomaly alerts.

Example:

If a vehicle normally achieves 10 KM/L but suddenly records 5 KM/L, flag:

"Unusual fuel consumption detected."

Allow management to investigate the corresponding trip/fuel entries.

All calculations must use real database data.

Fuel records must be auditable and should not be silently deleted.
Use archive/void functionality with a reason and audit log.

==================================================
VEHICLE MAINTENANCE MANAGEMENT
==================================================

Implement complete fleet maintenance management.

Every vehicle must have a maintenance profile.

Vehicle maintenance fields:

- Maintenance ID
- Vehicle ID
- Vehicle Number
- Maintenance type
- Service date
- Odometer KM
- Service center/vendor
- Technician/person responsible
- Work performed
- Parts replaced
- Labour cost
- Parts cost
- Other cost
- Total maintenance cost
- Invoice/document
- Remarks
- Created by
- Created date

Maintenance types:

- Regular Service
- Preventive Maintenance
- Oil Change
- Tyre Replacement
- Brake Service
- Engine Repair
- Electrical Repair
- Accident Repair
- Emergency Repair
- Other

Track maintenance schedule.

Vehicle must support:

- Last service date
- Last service KM
- Next service date
- Next service KM
- Service interval days
- Service interval KM
- Current odometer KM

Automatically determine whether maintenance is:

UP TO DATE
DUE SOON
DUE
OVERDUE

Example:

Last Service: 20,000 KM
Service Interval: 5,000 KM
Current KM: 24,700 KM

Status: DUE SOON

At 25,000 KM:

Status: DUE

Above 25,000 KM:

Status: OVERDUE

Create maintenance alerts.

Dashboard:

- Vehicles due for service
- Overdue maintenance
- Upcoming maintenance
- Maintenance cost this month
- Maintenance cost this year
- Highest maintenance-cost vehicles
- Vehicles currently under maintenance
- Recent repairs

Vehicle maintenance history should show a complete timeline:

Vehicle
→ Service
→ Repair
→ Parts replaced
→ Cost
→ Next service

Create maintenance reports:

- Vehicle Maintenance History
- Maintenance Cost Report
- Upcoming Service Report
- Overdue Service Report
- Vehicle Repair Report
- Parts Replacement Report

Allow attachments:

- Service invoice
- Repair bill
- Vehicle photographs
- Inspection report
- Other documents

When a vehicle is under maintenance:

Vehicle status should automatically be:

UNDER MAINTENANCE

It should not be available for dispatch unless an authorized user overrides the restriction.

Before dispatch assignment, check:

1. Vehicle active?
2. Vehicle available?
3. Maintenance overdue?
4. Required vehicle documents valid?
5. Insurance valid?
6. PUC valid?
7. Fitness valid?
8. Permit valid where applicable?

If critical maintenance/document conditions fail, prevent dispatch and show a clear reason.

All maintenance changes must be recorded in the audit log.

Maintenance records should not be permanently deleted by normal users.
Use archive/void with reason and approval where required.