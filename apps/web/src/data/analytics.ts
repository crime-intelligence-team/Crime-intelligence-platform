import type { CorrelationCell, TemporalDataPoint, StatisticalOutlier, SectorDistribution } from '../types'

export const THREAT_CATEGORIES = ['Cyber Attack','Social Unrest','Supply Chain','Data Breach','Physical Incursion','Financial Fraud']

// Correlation values [0-1]: higher = more correlated = darker rose cell
export const correlationMatrix: CorrelationCell[] = [
  { row:'Cyber Attack',       col:'Cyber Attack',       value:1.00 },
  { row:'Cyber Attack',       col:'Social Unrest',      value:0.30 },
  { row:'Cyber Attack',       col:'Supply Chain',       value:0.50 },
  { row:'Cyber Attack',       col:'Data Breach',        value:0.85 },
  { row:'Cyber Attack',       col:'Physical Incursion', value:0.20 },
  { row:'Cyber Attack',       col:'Financial Fraud',    value:0.65 },
  { row:'Social Unrest',      col:'Cyber Attack',       value:0.30 },
  { row:'Social Unrest',      col:'Social Unrest',      value:1.00 },
  { row:'Social Unrest',      col:'Supply Chain',       value:0.75 },
  { row:'Social Unrest',      col:'Data Breach',        value:0.20 },
  { row:'Social Unrest',      col:'Physical Incursion', value:0.60 },
  { row:'Social Unrest',      col:'Financial Fraud',    value:0.35 },
  { row:'Supply Chain',       col:'Cyber Attack',       value:0.50 },
  { row:'Supply Chain',       col:'Social Unrest',      value:0.75 },
  { row:'Supply Chain',       col:'Supply Chain',       value:1.00 },
  { row:'Supply Chain',       col:'Data Breach',        value:0.40 },
  { row:'Supply Chain',       col:'Physical Incursion', value:0.55 },
  { row:'Supply Chain',       col:'Financial Fraud',    value:0.70 },
  { row:'Data Breach',        col:'Cyber Attack',       value:0.85 },
  { row:'Data Breach',        col:'Social Unrest',      value:0.20 },
  { row:'Data Breach',        col:'Supply Chain',       value:0.40 },
  { row:'Data Breach',        col:'Data Breach',        value:1.00 },
  { row:'Data Breach',        col:'Physical Incursion', value:0.15 },
  { row:'Data Breach',        col:'Financial Fraud',    value:0.80 },
  { row:'Physical Incursion', col:'Cyber Attack',       value:0.20 },
  { row:'Physical Incursion', col:'Social Unrest',      value:0.60 },
  { row:'Physical Incursion', col:'Supply Chain',       value:0.55 },
  { row:'Physical Incursion', col:'Data Breach',        value:0.15 },
  { row:'Physical Incursion', col:'Physical Incursion', value:1.00 },
  { row:'Physical Incursion', col:'Financial Fraud',    value:0.75 },
  { row:'Financial Fraud',    col:'Cyber Attack',       value:0.65 },
  { row:'Financial Fraud',    col:'Social Unrest',      value:0.35 },
  { row:'Financial Fraud',    col:'Supply Chain',       value:0.70 },
  { row:'Financial Fraud',    col:'Data Breach',        value:0.80 },
  { row:'Financial Fraud',    col:'Physical Incursion', value:0.75 },
  { row:'Financial Fraud',    col:'Financial Fraud',    value:1.00 },
]

export const temporalData: TemporalDataPoint[] = [
  { quarter:'Q1', current:32, baseline:38              },
  { quarter:'Q2', current:48, baseline:42              },
  { quarter:'Q3', current:91, baseline:45, isAnomaly:true },
  { quarter:'Q4', current:67, baseline:44              },
]

export const outliers: StatisticalOutlier[] = [
  { id:'1', vector:'Cyber-Breach',   timeDelta:'T-2h',
    description:'Correlation spike +3.2σ above baseline in Zone 4. Simultaneous authentication failures linked to elevated network traffic.',
    severity:'critical' },
  { id:'2', vector:'Unrest-Supply',  timeDelta:'T-12h',
    description:'Anomalous drop in logistics velocity correlating strongly with local social unrest sentiment analysis.',
    severity:'elevated' },
  { id:'3', vector:'Fraud-Breach',   timeDelta:'T-24h',
    description:'Sustained baseline elevation noted across tertiary financial nodes following minor breach reports.',
    severity:'low' },
]

export const sectorData: SectorDistribution[] = [
  { name:'Critical Infra', value:21, color:'#f43f5e' },
  { name:'Financial',      value:29, color:'#f59e0b' },
  { name:'Gov/Public',     value:31, color:'#3b82f6' },
  { name:'Commercial',     value:19, color:'#475569' },
]

export const incidentTrend72h = [
  { h:'0h', v:42 }, { h:'6h',  v:58 }, { h:'12h', v:51 },
  { h:'18h', v:67 }, { h:'24h', v:74 }, { h:'30h', v:83 },
  { h:'36h', v:91 }, { h:'42h', v:78 }, { h:'48h', v:65 },
  { h:'54h', v:72 }, { h:'60h', v:69 }, { h:'66h', v:58 },
]
