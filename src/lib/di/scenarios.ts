// Complete mapping from Technical Document section 10
const SCENARIO_MAP: Record<string, Record<string, string[]>> = {
    'Manufacturer': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'],
        'Steel': ['SN003', 'SN004', 'SN011'],
        'FMCG': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN008'],
        'Textile': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN009'],
        'Telecom': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN010'],
        'Petroleum': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN012'],
        'Services': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN018', 'SN019'],
        'Wholesale / Retails': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'],
    },
    'Retailer': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'],
        'FMCG': ['SN026', 'SN027', 'SN028', 'SN008'],
        'Textile': ['SN009', 'SN026', 'SN027', 'SN028', 'SN008'],
        'Services': ['SN018', 'SN019', 'SN026', 'SN027', 'SN028', 'SN008'],
        'Wholesale / Retails': ['SN026', 'SN027', 'SN028', 'SN008'],
    },
    'Service Provider': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN018', 'SN019'],
        'Services': ['SN018', 'SN019'],
        'Telecom': ['SN010', 'SN018', 'SN019'],
    },
    'Importer': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'],
    },
    'Distributor': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'],
    },
    'Wholesaler': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'],
    },
    'Exporter': {
        'All Other Sectors': ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'],
    },
}

export const SCENARIO_DESCRIPTIONS: Record<string, string> = {
    'SN001': 'Goods at standard rate to registered buyers',
    'SN002': 'Goods at standard rate to unregistered buyers',
    'SN003': 'Sale of Steel (Melted and Re-Rolled)',
    'SN004': 'Sale by Ship Breakers',
    'SN005': 'Reduced rate sale',
    'SN006': 'Exempt goods sale',
    'SN007': 'Zero rated sale',
    'SN008': 'Sale of 3rd schedule goods',
    'SN009': 'Cotton Spinners purchase from Cotton Ginners (Textile)',
    'SN010': 'Telecom services rendered or provided',
    'SN011': 'Toll Manufacturing sale by Steel sector',
    'SN012': 'Sale of Petroleum products',
    'SN013': 'Electricity Supply to Retailers',
    'SN014': 'Sale of Gas to CNG stations',
    'SN015': 'Sale of mobile phones',
    'SN016': 'Processing / Conversion of Goods',
    'SN017': 'Sale of Goods where FED is charged in ST mode',
    'SN018': 'Services rendered where FED is charged in ST mode',
    'SN019': 'Services rendered or provided',
    'SN020': 'Sale of Electric Vehicles',
    'SN021': 'Sale of Cement / Concrete Block',
    'SN022': 'Sale of Potassium Chlorate',
    'SN023': 'Sale of CNG',
    'SN024': 'Goods sold listed in SRO 297(I)/2023',
    'SN025': 'Drugs sold at fixed ST rate (Eighth Schedule)',
    'SN026': 'Sale to End Consumer by retailers (Standard Rate)',
    'SN027': 'Sale to End Consumer by retailers (3rd Schedule)',
    'SN028': 'Sale to End Consumer by retailers (Reduced Rate)',
}

export function getRequiredScenarios(businessActivity: string, sector: string): string[] {
    return (
        SCENARIO_MAP[businessActivity]?.[sector] ??
        SCENARIO_MAP[businessActivity]?.['All Other Sectors'] ??
        ['SN001', 'SN002'] // Minimum fallback
    )
}
