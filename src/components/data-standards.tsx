'use client';
import {useMemo,useState, type KeyboardEvent} from 'react';
import {ArrowUpRight,BookOpen,CheckCircle2,Database,Download,FileJson,Search,ShieldCheck} from 'lucide-react';
import {scopeDataQuality,type QualityReport,type QualityDomain} from '@/lib/data-quality';
import type {Locale,Snapshot} from '@/lib/types';
import {toCsv} from '@/lib/csv';
import {dataStandardsMessages,type DataStandardsKey} from './data-standards.messages';
import './data-standards.css';

const issueKeys:Record<string,DataStandardsKey>={
  'history-invalid-observation':'issueInvalid','history-duplicate-date':'issueDuplicate',
  'history-future-observation':'issueFuture','history-missing-days':'issueGap',
  'history-insufficient-coverage':'issueCoverage','history-stale':'issueHistoryStale',
  'attendance-missing':'issueAttendance','diagnostic-unknown':'issueUnknown',
  'diagnostic-records-missing':'issueDiagnosticMissing','clinical-record-stale':'issueClinicalStale',
  'clinical-timestamp-invalid':'issueTimestamp','clinical-timestamp-future':'issueTimestampFuture',
  'inventory-record-missing':'issueInventoryMissing','medicine-catalogue-missing':'issueCatalogue',
  'facility-record-missing':'issueFacility',
};
const domainKeys:Record<QualityDomain,DataStandardsKey>={inventory:'inventory',attendance:'attendance',diagnostics:'diagnostics',facility:'facilityDomain',opd:'opd'};
const termKeys = ['opd','bed','stock','staffing','hmis','ehr','adt','lis','hai','coding','interchange'] as const;
const tabs = ['monitor','definitions','exchange'] as const;
type Tab = typeof tabs[number];
export default function DataStandards({snapshot,report,facilityIds,locale,onFacilitySelect}:{snapshot:Snapshot;report:QualityReport;facilityIds:string[];locale:Locale;onFacilitySelect:(id:string)=>void}) {
  const [tab,setTab]=useState<Tab>('monitor');
  const [termQuery,setTermQuery]=useState('');
  const copy=dataStandardsMessages[locale];
  const quality=useMemo(()=>scopeDataQuality(report,facilityIds),[report,facilityIds]);
  const summary=quality.summary;
  const facilityName=(id:string)=>snapshot.facilities.find(row=>row.id===id)?.name??id;
  const recordName=(recordId:string,domain:QualityDomain)=>domain==='inventory'?snapshot.medicines.find(m=>m.id===snapshot.inventory.find(i=>i.id===recordId)?.medicineId)?.name??recordId:domain==='diagnostics'?snapshot.diagnostics.find(d=>d.id===recordId)?.name??recordId:copy.opd;
  const format=(value:number)=>new Intl.NumberFormat(locale==='en'?'en-IN':locale==='hi'?'hi-IN':'mr-IN').format(value);
  function onTabKey(event:KeyboardEvent<HTMLButtonElement>,index:number) {
    let next=index;
    if(event.key==='ArrowRight')next=(index+1)%tabs.length;
    else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();setTab(tabs[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  function exportQuality() {
    const rows:unknown[][]=[['synthetic','analysisDate','revision','facilityId','facility','domain','recordId','finding','count']];
    quality.issues.forEach(row=>rows.push([true,snapshot.asOf,snapshot.revision,row.facilityId,facilityName(row.facilityId),copy[domainKeys[row.domain]],row.recordId??'',copy[issueKeys[row.code]]??row.code,row.count]));
    const url=URL.createObjectURL(new Blob(['\ufeff',toCsv(rows)],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download=`districtcare-quality-${snapshot.asOf}.csv`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const visibleTerms=termKeys.filter(term=>`${copy[`${term}Term`]} ${copy[`${term}Definition`]}`.toLowerCase().includes(termQuery.trim().toLowerCase()));
  return <section className="data-standards">
    <div className="source-provenance"><div><Database size={17}/><strong>{copy.source}</strong></div><dl><div><dt>{copy.assessed}</dt><dd>{snapshot.asOf}</dd></div><div><dt>{copy.revision}</dt><dd>{format(snapshot.revision)}</dd></div></dl></div>
    <div className="quality-tabs" role="tablist" aria-label={copy.definitions}>{tabs.map((id,index)=><button key={id} role="tab" id={`quality-tab-${id}`} aria-controls={`quality-panel-${id}`} aria-selected={tab===id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={e=>onTabKey(e,index)}>{id==='monitor'?<ShieldCheck size={16}/>:id==='definitions'?<BookOpen size={16}/>:<FileJson size={16}/>} {copy[id]}</button>)}</div>
    <div role="tabpanel" id={`quality-panel-${tab}`} aria-labelledby={`quality-tab-${tab}`} tabIndex={0}>
    {tab==='monitor'&&<>
      <div className="quality-metrics">{[
        {label:copy.eligible,value:`${format(summary.forecastEligibleSeries)} / ${format(summary.historySeries)}`,help:copy.eligibleHelp},
        {label:copy.stale,value:format(summary.staleRecords),help:copy.staleHelp},
        {label:copy.missingAttendance,value:format(summary.missingAttendanceFacilities),help:copy.attendanceHelp},
        {label:copy.anomalies,value:format(summary.invalidObservations+summary.duplicateObservations+summary.futureObservations+summary.missingDays),help:copy.anomalyHelp},
      ].map(metric=><article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.help}</p></article>)}</div>
      <section className="panel quality-panel"><div className="panel-heading"><div><h2>{copy.issueTitle}</h2><p>{copy.issueHelp}</p></div><button className="button secondary small" onClick={exportQuality}><Download size={15}/>{copy.exportQuality}</button></div><div className="table-scroll quality-scroll"><table><thead><tr><th>{copy.facility}</th><th>{copy.domain}</th><th>{copy.finding}</th><th>{copy.count}</th><th/></tr></thead><tbody>{quality.issues.map(row=><tr key={row.id}><td>{facilityName(row.facilityId)}</td><td>{copy[domainKeys[row.domain]]}<small>{row.recordId?recordName(row.recordId,row.domain):''}</small></td><td>{copy[issueKeys[row.code]]??row.code}</td><td>{format(row.count)}</td><td><button className="text-button" onClick={()=>onFacilitySelect(row.facilityId)}>{copy.review}<ArrowUpRight size={14}/></button></td></tr>)}</tbody></table>{!quality.issues.length&&<div className="quality-empty"><CheckCircle2 size={20}/>{copy.noIssues}</div>}</div></section>
      <section className="panel quality-panel"><div className="panel-heading"><div><h2>{copy.coverageTitle}</h2><p>{copy.coverageHelp}</p></div></div><div className="table-scroll quality-scroll"><table><thead><tr><th>{copy.facility}</th><th>{copy.series}</th><th>{copy.observations}</th><th>{copy.usable}</th><th>{copy.contiguous}</th><th>{copy.gaps}</th><th>{copy.latest}</th><th>{copy.status}</th></tr></thead><tbody>{quality.series.map(row=><tr key={`${row.domain}:${row.recordId}`}><td>{facilityName(row.facilityId)}</td><td>{recordName(row.recordId,row.domain)}</td><td>{format(row.observations)}</td><td>{format(row.validUniqueDays)}</td><td>{format(row.contiguousDays)}</td><td>{format(row.missingDays)}</td><td>{row.lastDate??copy.none}</td><td><span className={`quality-state ${row.forecastEligible?'ready':'review'}`}>{row.forecastEligible?copy.eligibleStatus:copy.insufficient}</span></td></tr>)}</tbody></table>{!quality.series.length&&<div className="quality-empty">{copy.noSeries}</div>}</div></section>
      <p className="quality-boundary">{copy.qualityNote}</p>
    </>}
    {tab==='definitions'&&<section className="panel quality-panel"><div className="panel-heading"><div><h2>{copy.metricTitle}</h2><p>{copy.metricHelp}</p></div></div><div className="definitions-search"><Search size={17}/><input aria-label={copy.glossarySearch} placeholder={copy.glossarySearch} value={termQuery} onChange={event=>setTermQuery(event.target.value)}/></div><dl className="metric-definitions">{visibleTerms.map(term=><div key={term}><dt>{copy[`${term}Term`]}</dt><dd>{copy[`${term}Definition`]}</dd></div>)}</dl>{!visibleTerms.length&&<div className="quality-empty">{copy.noTerms}</div>}</section>}
    {tab==='exchange'&&<>
      <section className="panel quality-panel"><div className="panel-heading"><div><h2>{copy.exportsTitle}</h2><p>{copy.exportsHelp}</p></div></div><div className="exchange-body"><a className="button primary" href={`/api/exports/facilities${facilityIds.length===1?`?facilityId=${encodeURIComponent(facilityIds[0])}`:''}`}><Download size={16}/>{facilityIds.length===1?copy.exportFacility:copy.exportDistrict}</a><p>{copy.exportBoundary}</p><div className="reference-links"><a href="https://hl7.org/fhir/R4/organization.html" target="_blank" rel="noreferrer">{copy.sourceLink}<ArrowUpRight size={14}/></a><a href="https://www.nrces.in/ndhm/fhir/r4/index.html" target="_blank" rel="noreferrer">{copy.standardsLink}<ArrowUpRight size={14}/></a></div></div></section>
      <section className="panel quality-panel"><div className="panel-heading"><h2>{copy.integrationTitle}</h2></div><div className="integration-register"><article><div><strong>DistrictCare</strong><p>{copy.availableDetail}</p></div><span className="quality-state ready">{copy.available}</span></article>{([
        ['ehrConnection','ehrConnectionDetail'],['diagnosticConnection','diagnosticConnectionDetail'],['infectionConnection','infectionConnectionDetail'],
      ] as const).map(([title,detail])=><article key={title}><div><strong>{copy[title]}</strong><p>{copy[detail]}</p></div><span className="quality-state review">{copy.planned}</span></article>)}</div></section>
    </>}
    </div>
  </section>;
}
