# FBR Digital Invoice Scenario Testing Guide
## Complete JSON Scenarios for Development

**Document Version:** 2025 Edition  
**Total Scenarios:** 28 (SN001 - SN028)  
**Last Updated:** April 2025

---

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Standard Rate Sales](#standard-rate-sales)
3. [Specialty & Sector-Specific](#specialty--sector-specific)
4. [Services & Processing](#services--processing)
5. [Utilities & Energy](#utilities--energy)
6. [Vehicles & Equipment](#vehicles--equipment)
7. [Special Tax Cases](#special-tax-cases)
8. [Retail Sales](#retail-sales)
9. [Implementation Notes](#implementation-notes)

---

## Quick Reference

| Scenario ID | Description | Tax Rate | Buyer Type | Key Feature |
|---|---|---|---|---|
| SN001 | Standard Rate to Registered | 18% | Registered | Input tax credit eligible |
| SN002 | Standard Rate to Unregistered | 18% | Unregistered | B2C sale |
| SN003 | Steel Melting & Re-rolling | 18% | Unregistered | Sector-specific |
| SN004 | Ship Breaking Steel Scrap | 18% | Unregistered | Special industry |
| SN005 | Reduced Rate (8th Schedule) | 1% | Unregistered | Essential goods |
| SN006 | Exempt Goods (6th Schedule) | 0% | Registered | No sales tax |
| SN007 | Zero-Rated (5th Schedule) | 0% | Unregistered | Export-friendly |
| SN008 | 3rd Schedule Goods | 18% | Unregistered | MRP-based taxation |
| SN009 | Cotton Ginners Purchase | 18% | Registered | Agricultural sector |
| SN010 | Telecom Services | 17% | Unregistered | Services |
| SN011 | Toll Manufacturing Steel | 18% | Unregistered | Processing service |
| SN012 | Petroleum Products | 1.43% | Unregistered | Special fuel rate |
| SN013 | Electricity to Retailers | 5% | Unregistered | Utility sector |
| SN014 | Gas to CNG Stations | 18% | Unregistered | Energy supply |
| SN015 | Mobile Phones | 18% | Unregistered | 9th Schedule |
| SN016 | Processing/Conversion | 5% | Unregistered | Service-based |
| SN017 | Goods (FED in ST Mode) | 8% | Unregistered | FED combined |
| SN018 | Services (FED in ST Mode) | 8% | Unregistered | Service FED |
| SN019 | Services (ICT Ordinance) | 5% | Unregistered | IT/Software sector |
| SN020 | Electric Vehicles | 1% | Unregistered | Green incentive |
| SN021 | Cement/Concrete Blocks | Rs.3/unit | Unregistered | Fixed rate |
| SN022 | Potassium Chlorate | 18% + Rs.60/kg | Unregistered | Dual rate |
| SN023 | CNG Sales | Rs.200/unit | Unregistered | Fuel sales |
| SN024 | Goods (SRO 297(I)/2023) | 25% | Unregistered | Special SRO |
| SN025 | Drugs (8th Schedule-81) | 0% | Unregistered | Medicines |
| SN026 | Standard Rate Retail | 18% | Registered | B2C retail |
| SN027 | 3rd Schedule Retail | 18% | Registered | Retail MRP |
| SN028 | Reduced Rate Retail | 1% | Registered | Retail reduced |

---

## Standard Rate Sales

### SN001: Sale of Standard Rate Goods to Registered Buyers
**Description:** Sale of goods at standard 18% sales tax to registered businesses who can claim input tax credits.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-10",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerNTNCNIC": "8885801",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "2046004",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "scenarioId": "SN001",
  "buyerRegistrationType": "Registered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 400,
      "totalValues": 0,
      "valueSalesExcludingST": 1000,
      "fixedNotifiedValueOrRetailPrice": 0.0,
      "salesTaxApplicable": 180,
      "salesTaxWithheldAtSource": 0,
      "extraTax": "",
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Goods at standard rate (default)",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN002: Sale of Standard Rate Goods to Unregistered Buyers
**Description:** B2C sale of standard rate goods to unregistered buyers (consumers). Full sales tax collected.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-10",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerNTNCNIC": "8885801",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1234567",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "scenarioId": "SN002",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 400,
      "totalValues": 0,
      "valueSalesExcludingST": 1000,
      "fixedNotifiedValueOrRetailPrice": 0.0,
      "salesTaxApplicable": 180,
      "salesTaxWithheldAtSource": 0,
      "extraTax": "",
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Goods at standard rate (default)",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

## Specialty & Sector-Specific

### SN003: Sale of Steel (Melted and Re-Rolled) - Billets, Ingots and Long Bars
**Description:** Steel sector transaction with specific tax treatment and traceability requirements.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerBusinessName": "Company 7",
  "sellerNTNCNIC": "8885801",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "3710505701479",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "sellerAddress": "Karachi",
  "invoiceRefNo": "0",
  "scenarioId": "SN003",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "7214.1010",
      "productDescription": "",
      "rate": "18%",
      "uoM": "MT",
      "quantity": 1,
      "totalValues": 0,
      "valueSalesExcludingST": 205000.0,
      "fixedNotifiedValueOrRetailPrice": 0.0,
      "salesTaxApplicable": 36900,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Steel melting and re-rolling",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN004: Sale of Steel Scrap by Ship Breakers
**Description:** Ship breaking industry transaction with special regulatory treatment.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-26",
  "sellerNTNCNIC": "4130276175937",
  "sellerBusinessName": "Company 8",
  "sellerAddress": "Karachi",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "3710505701479",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250421-001",
  "scenarioId": "SN004",
  "items": [
    {
      "hsCode": "7204.1010",
      "productDescription": "",
      "rate": "18%",
      "uoM": "MT",
      "quantity": 1,
      "totalValues": 0,
      "valueSalesExcludingST": 175000,
      "salesTaxApplicable": 31500,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Ship breaking",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN009: Purchase From Registered Cotton Ginners
**Description:** Agricultural sector transaction with specific cotton ginning rules.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-15",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "2046004",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "scenarioId": "SN009",
  "buyerRegistrationType": "Registered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 0,
      "totalValues": 2500,
      "valueSalesExcludingST": 2500,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 450,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Cotton ginners",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

## Reduced, Exempt & Zero-Rated Sales

### SN005: Sale of Reduced Rate Goods (Eighth Schedule)
**Description:** Essential goods taxed at reduced rate (lower than standard 18%) for affordability.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-06-30",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "B2",
  "sellerAddress": "Karachi",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "scenarioId": "SN005",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0102.2930",
      "productDescription": "product Description41",
      "rate": "1%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1.0,
      "totalValues": 0.00,
      "valueSalesExcludingST": 1000.00,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 10,
      "salesTaxWithheldAtSource": 50.23,
      "extraTax": "",
      "furtherTax": 120.00,
      "sroScheduleNo": "EIGHTH SCHEDULE Table 1",
      "fedPayable": 50.36,
      "discount": 56.36,
      "saleType": "Goods at Reduced Rate",
      "sroItemSerialNo": "82"
    }
  ]
}
```

---

### SN006: Sale of Exempt Goods (Sixth Schedule)
**Description:** Goods completely exempt from sales tax for essential items.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-07-01",
  "sellerBusinessName": "Company 8",
  "sellerNTNCNIC": "8885801",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "2046004",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250515-001",
  "scenarioId": "SN006",
  "buyerRegistrationType": "Registered",
  "items": [
    {
      "hsCode": "0102.2930",
      "productDescription": "product Description41",
      "rate": "Exempt",
      "uoM": "Numbers, pieces, units",
      "quantity": 1.0,
      "totalValues": 0.00,
      "valueSalesExcludingST": 10,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 0,
      "salesTaxWithheldAtSource": 50.23,
      "extraTax": "",
      "furtherTax": 120.00,
      "sroScheduleNo": "6th Schd Table I",
      "fedPayable": 50.36,
      "discount": 56.36,
      "saleType": "Exempt goods",
      "sroItemSerialNo": "100"
    }
  ]
}
```

---

### SN007: Sale of Zero-Rated Goods (Fifth Schedule)
**Description:** Zero sales tax but seller can claim input tax credits. Common for exports.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerBusinessName": "Company 7",
  "sellerNTNCNIC": "8885801",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "3710505701479",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "sellerAddress": "Karachi",
  "scenarioId": "SN007",
  "buyerRegistrationType": "Unregistered",
  "invoiceRefNo": "0",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "0%",
      "uoM": "Numbers, pieces, units",
      "quantity": 100,
      "totalValues": 0,
      "valueSalesExcludingST": 100,
      "salesTaxApplicable": 0,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "327(I)/2008",
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Goods at zero-rate",
      "sroItemSerialNo": "1"
    }
  ]
}
```

---

### SN008: Sale of 3rd Schedule Goods
**Description:** Tax based on printed retail price (MRP) rather than transaction value.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 7",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "3710505701479",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "sellerAddress": "Karachi",
  "invoiceRefNo": "0",
  "scenarioId": "SN008",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 100,
      "totalValues": 145,
      "valueSalesExcludingST": 0,
      "fixedNotifiedValueOrRetailPrice": 1000,
      "salesTaxApplicable": 180,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "3rd Schedule Goods",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

## Services & Processing

### SN010: Sale of Telecom Services by Mobile Operators
**Description:** Mobile services (calls, data, SMS) with special regulatory tax treatment.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-15",
  "sellerBusinessName": "Company 8",
  "sellerNTNCNIC": "8885801",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250515-001",
  "scenarioId": "SN010",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "17%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1000,
      "totalValues": 0,
      "valueSalesExcludingST": 100,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 17,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Telecommunication services",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN011: Sale of Steel through Toll Manufacturing
**Description:** Processing/conversion of raw materials into finished products on behalf of another party.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-26",
  "sellerNTNCNIC": "4130276175937",
  "sellerBusinessName": "Company 8",
  "sellerAddress": "Karachi",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "3710505701479",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "dataSource": "",
  "scenarioId": "SN011",
  "items": [
    {
      "hsCode": "7214.9990",
      "productDescription": "",
      "rate": "18%",
      "uoM": "MT",
      "quantity": 1,
      "totalValues": 205000,
      "valueSalesExcludingST": 205000,
      "salesTaxApplicable": 36900,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Toll Manufacturing",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN016: Processing / Conversion of Goods
**Description:** Charging for value-added manufacturing/processing service on client's materials.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-16",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000078",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "scenarioId": "SN016",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "5%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1,
      "totalValues": 0,
      "valueSalesExcludingST": 100,
      "salesTaxApplicable": 5,
      "salesTaxWithheldAtSource": 0,
      "fixedNotifiedValueOrRetailPrice": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Processing/Conversion of Goods",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN018: Sale of Services (FED in ST Mode)
**Description:** Services like advertising, franchise, insurance with FED collected through sales tax system.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-06-14",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000056",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250421-001",
  "scenarioId": "SN018",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "8%",
      "uoM": "Numbers, pieces, units",
      "quantity": 20,
      "totalValues": 0,
      "valueSalesExcludingST": 1000,
      "salesTaxApplicable": 80,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Services (FED in ST Mode)",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN019: Sale of Services (as per ICT Ordinance)
**Description:** Software, IT consultancy, and ICT services under special ordinance with specific rates.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250421-001",
  "buyerRegistrationType": "Unregistered",
  "scenarioId": "SN019",
  "items": [
    {
      "hsCode": "0101.2900",
      "productDescription": "TEST",
      "rate": "5%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1,
      "totalValues": 0,
      "valueSalesExcludingST": 100,
      "salesTaxApplicable": 5,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "ICTO TABLE I",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Services",
      "sroItemSerialNo": "1(ii)(ii)(a)"
    }
  ]
}
```

---

## Utilities & Energy

### SN012: Sale of Petroleum Products
**Description:** Petrol, diesel, lubricants with special tax rates and federal excise duties.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-15",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250515-001",
  "scenarioId": "SN012",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "1.43%",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "totalValues": 132,
      "valueSalesExcludingST": 100,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 1.43,
      "salesTaxWithheldAtSource": 2,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "1450(I)/2021",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Petroleum Products",
      "sroItemSerialNo": "4"
    }
  ]
}
```

---

### SN013: Sale of Electricity to Retailers
**Description:** Wholesale electricity sales to retailers with special tax treatment.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-15",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250515-001",
  "scenarioId": "SN013",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "5%",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "totalValues": 212,
      "valueSalesExcludingST": 1000,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 50,
      "salesTaxWithheldAtSource": 11,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "1450(I)/2021",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Electricity Supply to Retailers",
      "sroItemSerialNo": "4"
    }
  ]
}
```

---

### SN014: Sale of Gas to CNG Stations
**Description:** Natural gas supply to CNG filling stations with special regulatory treatment.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-15",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250515-001",
  "scenarioId": "SN014",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "totalValues": 0,
      "valueSalesExcludingST": 1000,
      "salesTaxApplicable": 180,
      "salesTaxWithheldAtSource": 0,
      "fixedNotifiedValueOrRetailPrice": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Gas to CNG stations",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN023: Sale of CNG
**Description:** CNG fuel sales at CNG stations with fixed rate per unit and automated billing.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Unregistered",
  "scenarioId": "SN023",
  "invoiceRefNo": "SI-20250421-001",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "Rs.200/unit",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "valueSalesExcludingST": 234,
      "fixedNotifiedValueOrRetailPrice": 200,
      "salesTaxApplicable": 24600,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "581(1)/2024",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "CNG Sales",
      "sroItemSerialNo": "Region-I"
    }
  ]
}
```

---

## Vehicles & Equipment

### SN015: Sale of Mobile Phones
**Description:** Mobile handsets under 9th Schedule with potential additional duties and regulatory charges.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-15",
  "sellerBusinessName": "Company 8",
  "sellerNTNCNIC": "8885801",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250515-001",
  "scenarioId": "SN015",
  "buyerRegistrationType": "Unregistered",
  "additional1": "",
  "additional2": "",
  "additional3": "",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "totalValues": 0,
      "valueSalesExcludingST": 1234,
      "salesTaxApplicable": 222.12,
      "salesTaxWithheldAtSource": 0,
      "fixedNotifiedValueOrRetailPrice": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "NINTH SCHEDULE",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Mobile Phones",
      "sroItemSerialNo": "1(A)"
    }
  ]
}
```

---

### SN020: Sale of Electric Vehicles
**Description:** EV sales with reduced tax rate incentive to promote green transportation.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Unregistered",
  "scenarioId": "SN020",
  "invoiceRefNo": "SI-20250421-001",
  "items": [
    {
      "hsCode": "0101.2900",
      "productDescription": "TEST",
      "rate": "1%",
      "uoM": "Numbers, pieces, units",
      "quantity": 122,
      "totalValues": 0,
      "valueSalesExcludingST": 1000,
      "salesTaxApplicable": 10,
      "salesTaxWithheldAtSource": 0,
      "fixedNotifiedValueOrRetailPrice": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "6th Schd Table III",
      "fedPayable": 0,
      "discount": 0,
      "saleType": "Electric Vehicle",
      "sroItemSerialNo": "20"
    }
  ]
}
```

---

## Special Tax Cases

### SN017: Sale of Goods Where FED Is Charged in ST Mode
**Description:** Federal Excise Duty collected through sales tax system instead of separately.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-10",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "7000009",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "scenarioId": "SN017",
  "buyerRegistrationType": "Unregistered",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "8%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1,
      "valueSalesExcludingST": 100,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxApplicable": 8,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "Goods (FED in ST Mode)",
      "sroScheduleNo": "",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN021: Sale of Cement / Concrete Block
**Description:** Construction materials taxed at fixed rate per unit with input-output tracking.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "SI-20250421-001",
  "buyerRegistrationType": "Unregistered",
  "scenarioId": "SN021",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "Rs.3 per unit",
      "uoM": "Numbers, pieces, units",
      "quantity": 12,
      "valueSalesExcludingST": 123,
      "salesTaxApplicable": 36,
      "fixedNotifiedValueOrRetailPrice": 3,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "Cement /Concrete Block",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN022: Sale of Potassium Chlorate
**Description:** Sensitive chemical with fixed tax per kilogram for matchstick manufacturing.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Unregistered",
  "scenarioId": "SN022",
  "invoiceRefNo": "SI-20250421-001",
  "items": [
    {
      "hsCode": "3104.2000",
      "productDescription": "TEST",
      "rate": "18% + Rs.60/kg",
      "uoM": "KG",
      "quantity": 1,
      "valueSalesExcludingST": 100,
      "fixedNotifiedValueOrRetailPrice": 60,
      "salesTaxApplicable": 78,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "EIGHTH SCHEDULE Table 1",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "Potassium Chlorate",
      "sroItemSerialNo": "56"
    }
  ]
}
```

---

### SN024: Sale of Goods Listed in SRO 297(1)/2023
**Description:** Specific goods with reduced/special tax rates (solar, medical devices, energy-efficient).

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Unregistered",
  "scenarioId": "SN024",
  "invoiceRefNo": "SI-20250421-001",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "25%",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "valueSalesExcludingST": 1000,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxApplicable": 250,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "297(I)/2023-Table-I",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "Goods as per SRO.297(I)/2023",
      "sroItemSerialNo": "12"
    }
  ]
}
```

---

### SN025: Drugs Sold at Fixed ST Rate (8th Schedule-81)
**Description:** Pharmaceutical products at fixed reduced rate for affordability.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-16",
  "sellerNTNCNIC": "8885801",
  "sellerBusinessName": "Company 8",
  "sellerAddress": "Karachi",
  "sellerProvince": "Sindh",
  "buyerNTNCNIC": "1000000000078",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Unregistered",
  "invoiceRefNo": "",
  "scenarioId": "SN025",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "0%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1,
      "valueSalesExcludingST": 100,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxApplicable": 0,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "EIGHTH SCHEDULE Table 1",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "Non-Adjustable Supplies",
      "sroItemSerialNo": "81"
    }
  ]
}
```

---

## Retail Sales

### SN026: Sale of Goods at Standard Rate to End Consumers by Retailers
**Description:** Retail B2C transaction with standard 18% tax through POS systems.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-16",
  "sellerNTNCNIC": "7000008",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000078",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Registered",
  "scenarioId": "SN026",
  "invoiceRefNo": "SI-20250421-001",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 123,
      "valueSalesExcludingST": 1000,
      "fixedNotifiedValueOrRetailPrice": 0,
      "salesTaxApplicable": 180,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "Goods at standard rate (default)",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN027: Sale of 3rd Schedule Goods to End Consumers by Retailers
**Description:** Retail sale of branded FMCGs with MRP-based tax calculation.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-10",
  "sellerNTNCNIC": "7000008",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "7000006",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Registered",
  "invoiceRefNo": "",
  "scenarioId": "SN027",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "test",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1,
      "valueSalesExcludingST": 0,
      "fixedNotifiedValueOrRetailPrice": 100,
      "salesTaxApplicable": 18,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 0,
      "saleType": "3rd Schedule Goods",
      "sroItemSerialNo": ""
    }
  ]
}
```

---

### SN028: Sale of Goods at Reduced Rate to End Consumers by Retailers
**Description:** Retail sale of essential items (baby milk, books) at reduced tax rate.

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-05-16",
  "sellerNTNCNIC": "7000008",
  "sellerBusinessName": "Company 8",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "FERTILIZER MANUFAC IRS NEW",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "invoiceRefNo": "",
  "buyerRegistrationType": "Registered",
  "scenarioId": "SN028",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "TEST",
      "rate": "1%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1,
      "valueSalesExcludingST": 99.01,
      "fixedNotifiedValueOrRetailPrice": 100,
      "salesTaxApplicable": 0.99,
      "salesTaxWithheldAtSource": 0,
      "extraTax": 0,
      "furtherTax": 0,
      "sroScheduleNo": "EIGHTH SCHEDULE Table 1",
      "fedPayable": 0,
      "discount": 0,
      "totalValues": 100,
      "saleType": "Goods at Reduced Rate",
      "sroItemSerialNo": "70"
    }
  ]
}
```

---

## Implementation Notes

### Pre-Implementation Checklist

- [ ] **FBR Registration:** Complete IRIS portal registration with licensed integrator
- [ ] **Static IP Whitelisting:** Get your static IP whitelisted by FBR/PRAL
- [ ] **Sandbox Token:** Obtain sandbox API token from IRIS portal
- [ ] **Test NTN/CNIC:** Get valid test NTN/CNIC from FBR for sandbox testing
- [ ] **API Documentation:** Download official FBR API technical documentation
- [ ] **JSON Validation:** Use JSON validator tool before submission

### Important Development Guidelines

#### 1. Field Replacements Required
Before using any JSON template, replace these placeholders with actual data:
- `YOUR_NTN` → Your company's actual NTN
- `YOUR_BUSINESS_NAME` → Your actual business name
- `YOUR_PROVINCE` → Your province (Sindh, Punjab, KP, Balochistan)
- `YOUR_ADDRESS` → Your actual address
- `invoiceDate` → Use current or recent date (YYYY-MM-DD format)
- `invoiceRefNo` → Unique reference number for each test
- `buyerNTNCNIC` → Use FBR-provided test NTN/CNIC

#### 2. Tax Calculation Rules
- **Standard Rate:** 18% on valueSalesExcludingST
- **Reduced Rate:** Use provided rate on valueSalesExcludingST
- **3rd Schedule:** Tax on fixedNotifiedValueOrRetailPrice, NOT valueSalesExcludingST
- **Zero-Rated:** 0% but seller can claim input tax credit
- **Exempt:** 0% and no input tax credit

#### 3. Common Validation Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid HS Code | HS code doesn't match sale type | Verify HS code against FBR reference |
| NTN/CNIC not valid | Invalid or unregistered NTN | Use FBR-provided test NTN for sandbox |
| Extra Tax in reduced rate | Reduced rate items shouldn't have extra tax | Set extraTax to 0 or empty string |
| MRP calculation error | Using valueSalesExcludingST instead of MRP | Use fixedNotifiedValueOrRetailPrice for 3rd Schedule |
| Incorrect sroScheduleNo | Wrong schedule reference | Verify against FBR official schedules |

#### 4. Testing Sequence Recommendation
1. Start with SN001 (simplest - standard rate to registered)
2. Test SN002 (standard rate to unregistered)
3. Move to reduced/exempt rates (SN005, SN006, SN007)
4. Test sector-specific scenarios relevant to your business
5. Complete FED and special cases
6. Test all retail scenarios if applicable

#### 5. Cursor Workspace Setup
```bash
# Suggested folder structure
/fbr-einvoice-testing
  ├── scenarios/
  │   ├── standard-rate/
  │   ├── reduced-exempt/
  │   ├── sector-specific/
  │   ├── services/
  │   └── utilities/
  ├── validators/
  ├── api-calls/
  ├── test-results/
  └── notes.md
```

#### 6. API Call Format (Postman/Code)
```
POST https://sandbox.pral.pk/api/v1/ironsides/invoices/submit
Headers:
  Authorization: Bearer [YOUR_SANDBOX_TOKEN]
  Content-Type: application/json

Body: [JSON from scenarios above]
```

#### 7. Token Management
- **Sandbox Token:** Available in IRIS → Sandbox Environment tab
- **Format:** Use as `Bearer [token]` in Authorization header
- **Production Token:** Generated after all sandbox scenarios pass
- **Refresh:** Tokens may expire; regenerate if needed

---

## Success Indicators

✅ **Sandbox Testing Complete When:**
- All 28 (or assigned) scenarios show "Success" status
- No validation errors remain
- All invoices accepted by FBR API
- Zero duplicate or retry submissions

✅ **Ready for Production When:**
- Production token generated in IRIS portal
- All sandbox scenarios marked as "Cleared"
- FBR approval notification received
- Integration endpoints switched to production URL

---

## Quick Troubleshooting

**Q: Token shows as invalid**  
A: Regenerate token from IRIS Sandbox Environment tab. Ensure correct format: `Bearer [token]`

**Q: HS Code validation error**  
A: Cross-check HS code against FBR reference. Some codes only valid for specific sale types.

**Q: NTN not recognized**  
A: Use test NTN provided by FBR. Sandbox doesn't validate against NADRA; must be FBR-provided test value.

**Q: Calculation errors**  
A: Remember: 3rd Schedule uses MRP (fixedNotifiedValueOrRetailPrice), others use transaction value (valueSalesExcludingST)

**Q: API timeout**  
A: Check FBR system status. Verify static IP whitelisting. Retry after 5 minutes.

---

## Contact & Support

**For Integration Issues:** +92 300 9778848  
**FBR Official Documentation:** https://fbr.gov.pk/  
**PRAL Portal:** https://www.pral.pk/

---

**Document Generated:** April 21, 2025  
**Version:** 1.0 - Complete  
**For Use In:** Cursor IDE, VSCode, or any text editor  
**Format:** Markdown (.md)
