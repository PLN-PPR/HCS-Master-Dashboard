const APP_CONFIG=window.HCS_CONFIG||{};
const MONTHS=['Jan','Feb','Mar','Apr','Mei','Juni','Juli','Agu','Sep','Okt','Nov','Des'];
const PALETTE={navy:'#0b3d73',blue:'#0d67b5',blue2:'#2f86d2',sky:'#66ace6',teal:'#159ca1',teal2:'#56bcc0',grid:'#edf1f6',text:'#16385f'};
let WB=null, DATA={}, charts={}, activeTable='plgTahunan';
const $=id=>document.getElementById(id);
const clean=v=>String(v??'').trim();
const num=v=>(v===''||v==null||Number.isNaN(Number(v)))?null:Number(v);
const has=v=>v!==''&&v!=null&&clean(v)!=='';
const fmtInt=v=>Number(v||0).toLocaleString('id-ID',{maximumFractionDigits:0});
const fmtGWh=v=>Number(v||0).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct=v=>Number(v||0).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const fmtLabelInt=v=>Number(v).toLocaleString('id-ID',{maximumFractionDigits:0});
const fmtLabelGWh=v=>Number(v).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});

const valueLabelsPlugin={
  id:'valueLabels',
  afterDatasetsDraw(chart,args,pluginOptions){
    if(pluginOptions?.display===false)return;
    const ctx=chart.ctx;
    ctx.save();
    ctx.font='600 9px "Segoe UI", Arial, sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    chart.data.datasets.forEach((dataset,datasetIndex)=>{
      const meta=chart.getDatasetMeta(datasetIndex);
      if(meta.hidden)return;
      meta.data.forEach((element,dataIndex)=>{
        const raw=dataset.data[dataIndex];
        if(raw===null||raw===undefined||raw==='')return;
        let text;
        if(typeof pluginOptions?.formatter==='function'){
          text=pluginOptions.formatter(raw,{chart,dataset,datasetIndex,dataIndex,label:chart.data.labels?.[dataIndex]});
        }else{
          text=typeof raw==='number'?fmtLabelGWh(raw):String(raw);
        }
        if(text===null||text===undefined||text==='')return;
        const pos=element.tooltipPosition();
        const isDoughnut=chart.config.type==='doughnut';
        ctx.fillStyle=isDoughnut?'#ffffff':(pluginOptions?.color||PALETTE.text);
        if(isDoughnut){
          ctx.font='700 9px "Segoe UI", Arial, sans-serif';
          ctx.fillText(text,pos.x,pos.y);
        }else{
          const offset=(datasetIndex%2)*11;
          ctx.fillText(text,pos.x,pos.y-9-offset);
        }
      });
    });
    ctx.restore();
  }
};
Chart.register(valueLabelsPlugin);

function sheetRows(payload,name){return payload?.sheets?.[name]?.rows||[]}
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id]}}
function chartCsvRows(chart){
  if(chart.config.type==='doughnut'){
    const ds=chart.data.datasets[0]||{data:[]};
    return [['Kategori',ds.label||'Nilai'],...(chart.data.labels||[]).map((label,i)=>[label,ds.data[i]??''])];
  }
  const headers=['Periode',...chart.data.datasets.map(ds=>ds.label||'Nilai')];
  const rows=(chart.data.labels||[]).map((label,i)=>[label,...chart.data.datasets.map(ds=>ds.data[i]??'')]);
  return [headers,...rows];
}
function makeChart(id,type,labels,datasets,opts={}){
  destroyChart(id);
  const el=$(id);if(!el)return;
  charts[id]=new Chart(el,{
    type,
    data:{labels,datasets},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{top:16,right:6,left:2,bottom:0}},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:datasets.length>1,position:'top',labels:{boxWidth:10,usePointStyle:true,font:{size:9}}},
        tooltip:{callbacks:opts.tooltipCallbacks||{}},
        valueLabels:{display:true,formatter:opts.labelFormatter||((v)=>v==null?'':String(v)),color:PALETTE.text}
      },
      scales:type==='doughnut'?{}:{
        x:{grid:{display:false},ticks:{font:{size:9},maxRotation:0}},
        y:{beginAtZero:opts.beginAtZero!==false,grace:'12%',grid:{color:PALETTE.grid},ticks:{font:{size:9},callback:opts.tickCallback}}
      }
    }
  });
  charts[id].$downloadName=opts.downloadName||id;
  charts[id].$csvRows=opts.csvRows||chartCsvRows(charts[id]);
}
function scopeRows(rows,uid){return uid==='NASIONAL'?rows:rows.filter(r=>clean(r.uid_uiw)===uid)}
function availableMonths(rows,year=2026,metricKeys=[]){const s=new Set();rows.filter(r=>num(r.tahun)===year).forEach(r=>{const m=num(r.bulan_no);if(!m)return;if(metricKeys.some(k=>has(r[k])))s.add(m)});return [...s].sort((a,b)=>a-b)}
function optionUIDs(){const uids=[...new Set(DATA.bulanan.map(r=>clean(r.uid_uiw)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));return ['NASIONAL',...uids]}
function fillUIDSelect(id){const el=$(id);if(!el)return;const prev=el.value;const values=optionUIDs();el.innerHTML=values.map(u=>`<option value="${u}">${u==='NASIONAL'?'Nasional':u}</option>`).join('');if(values.includes(prev))el.value=prev}
function fillMonthSelect(id,sourceRows,metricKeys,year=2026){const el=$(id);if(!el)return;const prev=num(el.value);const av=availableMonths(sourceRows,year,metricKeys);el.innerHTML=av.map(m=>`<option value="${m}">${MONTHS[m-1]}</option>`).join('');el.value=String(prev&&av.includes(prev)?prev:(av.at(-1)||1))}
function monthSeries(rows,metric,uid,through,year=2026){const base=scopeRows(rows.filter(r=>num(r.tahun)===year),uid);return MONTHS.slice(0,through).map((_,i)=>{const rs=base.filter(r=>num(r.bulan_no)===i+1&&num(r[metric])!==null);return rs.length?rs.reduce((s,r)=>s+(num(r[metric])||0),0):null})}
function kumSeries(uid,through,year=2026){return monthSeries(DATA.kumulatif,'penjualan kumulatif (kWh)',uid,through,year)}

async function loadDatabase(){
  const status=$('dbStatus');status.textContent='Memuat database…';
  const payload=await loadAppsScriptData();
  if(payload?._meta?.success===false)throw new Error(payload._meta.message||'Google Sheet gagal dibaca');
  DATA.plgTahunan=sheetRows(payload,'1_PLG_TAHUNAN');
  DATA.bulanan=sheetRows(payload,'2_PLGKWH_BULANAN2026');
  DATA.kumulatif=sheetRows(payload,'3_KWH_KUMULATIF2026');
  DATA.kwhTahunan=sheetRows(payload,'4_NASIONAL_KWH_TAHUNAN');
  DATA.integrasi=sheetRows(payload,'5_PLGKWH_BULANAN_INTEGRASI');
  DATA.diskon=sheetRows(payload,'6_KWH_DIKSON');
  const missing=['1_PLG_TAHUNAN','2_PLGKWH_BULANAN2026','3_KWH_KUMULATIF2026','4_NASIONAL_KWH_TAHUNAN','5_PLGKWH_BULANAN_INTEGRASI','6_KWH_DIKSON'].filter(name=>!payload?.sheets?.[name]);
  if(missing.length)throw new Error('Tab tidak ditemukan: '+missing.join(', '));
  status.textContent='● Google Sheet aktif';
  status.style.color='#c8f6ee';
  initFilters();renderAll();
}

function loadAppsScriptData(){
  const url=String(APP_CONFIG.APPS_SCRIPT_URL||'').trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){
    return Promise.reject(new Error('URL Apps Script /exec belum diisi pada js/config.js'));
  }
  return new Promise((resolve,reject)=>{
    const callback='hcsData_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    const timer=setTimeout(()=>finish(new Error('Waktu membaca Google Sheet habis')),30000);
    function finish(error,data){
      clearTimeout(timer);delete window[callback];script.remove();
      error?reject(error):resolve(data);
    }
    window[callback]=data=>finish(null,data);
    script.onerror=()=>finish(new Error('Endpoint Apps Script tidak dapat diakses'));
    script.src=url+'?callback='+encodeURIComponent(callback)+'&t='+Date.now();
    document.head.appendChild(script);
  });
}
function initFilters(){
  ['f1UID','f2UID','f4UID','f5UID','f6UID'].forEach(fillUIDSelect);
  fillMonthSelect('f2Month',DATA.bulanan,['penambahan plg bulanan (plg)']);
  fillMonthSelect('f4Month',DATA.bulanan,['penjualan bulanan (kWh)']);
  fillMonthSelect('f5Month',DATA.bulanan,['penjualan bulanan (kWh)']);
  fillMonthSelect('f6Month',DATA.kumulatif,['penjualan kumulatif (kWh)']);
  fillMonthSelect('f7Month',DATA.integrasi,['pelanggan bulanan (plg)']);
  fillMonthSelect('f8Month',DATA.integrasi,['pelanggan bulanan (plg)']);
  fillMonthSelect('f9Month',DATA.integrasi,['penjualan bulanan (KWh)']);
  fillMonthSelect('f10Month',DATA.diskon,['penjualan bulanan (kWh)']);
}
function latestAvailablePeriod(rows,metricKeys){
  const periods=[];
  rows.forEach(r=>{
    const year=num(r.tahun),month=num(r.bulan_no);
    if(!year||!month)return;
    if(metricKeys.some(k=>has(r[k])))periods.push({year,month});
  });
  if(!periods.length)return null;
  periods.sort((a,b)=>a.year-b.year||a.month-b.month);
  return periods.at(-1);
}
function nationalMonthlyTotal(rows,year,month,metric){
  const selected=rows.filter(r=>num(r.tahun)===year&&num(r.bulan_no)===month&&num(r[metric])!==null);
  if(!selected.length)return null;
  return selected.reduce((s,r)=>s+(num(r[metric])||0),0);
}
function previousCalendarPeriod(year,month){
  return month>1?{year,month:month-1}:{year:year-1,month:12};
}
function periodLabel(p,prefix=''){
  if(!p)return 'Belum ada data';
  return `${prefix}${MONTHS[p.month-1]} ${p.year}`;
}
function renderKPI(){
  // Executive Summary selalu Nasional dan otomatis mengikuti periode data terakhir
  const pTotal=latestAvailablePeriod(DATA.integrasi,['pelanggan bulanan (plg)']);
  const pAdd=latestAvailablePeriod(DATA.bulanan,['penambahan plg bulanan (plg)']);
  const pKwh=latestAvailablePeriod(DATA.bulanan,['penjualan bulanan (kWh)']);
  // Transaksi Kumulatif Executive Summary mengambil nilai Nasional tahunan dari sheet 4.
  // Label periodenya mengikuti periode terakhir Total Pelanggan HCS (pTotal).
  const kumYear=pTotal?.year||pKwh?.year||null;

  const total=pTotal?nationalMonthlyTotal(DATA.integrasi,pTotal.year,pTotal.month,'pelanggan bulanan (plg)'):null;
  const add=pAdd?nationalMonthlyTotal(DATA.bulanan,pAdd.year,pAdd.month,'penambahan plg bulanan (plg)'):null;
  const kwh=pKwh?nationalMonthlyTotal(DATA.bulanan,pKwh.year,pKwh.month,'penjualan bulanan (kWh)'):null;
  const kum=kumYear?DATA.kwhTahunan
    .filter(r=>num(r.tahun)===kumYear&&num(r['penjualan tahunan (kWh)'])!==null)
    .reduce((sum,r)=>sum+(num(r['penjualan tahunan (kWh)'])||0),0):null;

  let mom=null;
  if(pKwh&&kwh!==null){
    const prevP=previousCalendarPeriod(pKwh.year,pKwh.month);
    const prev=nationalMonthlyTotal(DATA.bulanan,prevP.year,prevP.month,'penjualan bulanan (kWh)');
    if(prev!==null&&prev!==0)mom=((kwh/prev)-1)*100;
  }

  $('kpiPelanggan').textContent=total===null?'–':fmtInt(total);
  $('kpiPenambahan').textContent=add===null?'–':fmtInt(add);
  $('kpiKwh').textContent=kwh===null?'–':fmtGWh(kwh/1e6);
  $('kpiKumulatif').textContent=kum===null?'–':fmtGWh(kum/1e6);
  $('kpiMom').textContent=mom==null?'–':(mom>=0?'+':'')+fmtPct(mom);
  $('kpiMom').style.color=mom==null?'':mom>=0?PALETTE.teal:PALETTE.navy;

  $('kpiPelangganSub').textContent=periodLabel(pTotal,'s.d. ');
  $('kpiPenambahanSub').textContent=periodLabel(pAdd);
  $('kpiKwhSub').textContent=`${periodLabel(pKwh)} · GWh`;
  $('kpiMomSub').textContent=`${periodLabel(pKwh,'s.d. ')} · vs bulan sebelumnya`;
  $('kpiKumulatifSub').textContent=`${periodLabel(pTotal,'s.d. ')} · GWh`;
}
function renderCharts(){
  const u1=$('f1UID').value;const aRows=u1==='NASIONAL'?DATA.plgTahunan:DATA.plgTahunan.filter(r=>clean(r.uid_uiw)===u1);const yrs=[...new Set(aRows.map(r=>num(r.tahun)).filter(Boolean))].sort();const vals=yrs.map(y=>aRows.filter(r=>num(r.tahun)===y).reduce((s,r)=>s+(num(r['penambahan plg tahunan (plg)'])||0),0));
  makeChart('chartPlgTahunan','bar',yrs,[{label:'Pelanggan',data:vals,borderRadius:6,backgroundColor:PALETTE.blue}],{tickCallback:fmtInt,labelFormatter:v=>fmtLabelInt(v),tooltipCallbacks:{label:c=>`${fmtInt(c.raw)} pelanggan`},downloadName:'Penambahan_HCS_Tahunan'});

  const m2=num($('f2Month').value)||1,u2=$('f2UID').value,l2=MONTHS.slice(0,m2),v2=monthSeries(DATA.bulanan,'penambahan plg bulanan (plg)',u2,m2);
  makeChart('chartPlgBulanan','bar',l2,[{label:'Pelanggan',data:v2,borderRadius:5,backgroundColor:PALETTE.blue2}],{tickCallback:fmtInt,labelFormatter:v=>v==null?'':fmtLabelInt(v),tooltipCallbacks:{label:c=>c.raw==null?'Belum ada data':`${fmtInt(c.raw)} pelanggan`},downloadName:'Penambahan_HCS_Bulanan_2026'});

  const ann=DATA.kwhTahunan.filter(r=>num(r['penjualan tahunan (kWh)'])!==null);
  makeChart('chartKwhTahunan','bar',ann.map(r=>r.tahun),[{label:'Transaksi (GWh)',data:ann.map(r=>num(r['penjualan tahunan (kWh)'])/1e6),borderRadius:6,backgroundColor:PALETTE.teal}],{tickCallback:fmtGWh,labelFormatter:v=>fmtLabelGWh(v),tooltipCallbacks:{label:c=>`${fmtGWh(c.raw)} GWh`},downloadName:'Transaksi_HCS_per_Tahun'});

  const m4=num($('f4Month').value)||1,u4=$('f4UID').value,l4=MONTHS.slice(0,m4),v4=monthSeries(DATA.bulanan,'penjualan bulanan (kWh)',u4,m4).map(v=>v==null?null:v/1e6);
  makeChart('chartKwhBulanan','line',l4,[{label:'kWh (GWh)',data:v4,borderColor:PALETTE.teal,backgroundColor:PALETTE.teal,tension:.28,pointRadius:3,pointHoverRadius:5,spanGaps:false}],{tickCallback:fmtGWh,labelFormatter:v=>v==null?'':fmtLabelGWh(v),tooltipCallbacks:{label:c=>c.raw==null?'Belum ada data':`${fmtGWh(c.raw)} GWh`},downloadName:'Tren_Transaksi_Bulanan_2026'});

  const m5=num($('f5Month').value)||1,u5=$('f5UID').value,l5=MONTHS.slice(0,m5),b5=monthSeries(DATA.bulanan,'penjualan bulanan (kWh)',u5,m5).map(v=>v==null?null:v/1e6),mom=b5.map((v,i)=>i===0||v==null||b5[i-1]==null||!b5[i-1]?null:((v/b5[i-1])-1)*100);
  makeChart('chartMom','line',l5,[{label:'MoM (%)',data:mom,borderColor:PALETTE.blue,backgroundColor:PALETTE.blue,tension:.25,pointRadius:4}],{beginAtZero:false,tickCallback:v=>v+'%',labelFormatter:v=>v==null?'':`${v>=0?'+':''}${fmtPct(v)}`,tooltipCallbacks:{label:c=>c.raw==null?'–':(c.raw>=0?'+':'')+fmtPct(c.raw)},downloadName:'Pertumbuhan_Transaksi_MoM_2026'});

  const m6=num($('f6Month').value)||1,u6=$('f6UID').value,l6=MONTHS.slice(0,m6),v6=kumSeries(u6,m6).map(v=>v==null?null:v/1e6);
  makeChart('chartKumulatif','line',l6,[{label:'Kumulatif (GWh)',data:v6,borderColor:PALETTE.blue,backgroundColor:'rgba(13,103,181,.12)',fill:true,tension:.25,pointRadius:3}],{tickCallback:fmtGWh,labelFormatter:v=>v==null?'':fmtLabelGWh(v),tooltipCallbacks:{label:c=>c.raw==null?'Belum ada data':`${fmtGWh(c.raw)} GWh`},downloadName:'Transaksi_Kumulatif_2026'});

  const m7=num($('f7Month').value)||1,seg=DATA.integrasi.filter(r=>num(r.tahun)===2026&&num(r.bulan_no)===m7&&num(r['pelanggan bulanan (plg)'])!==null);
  destroyChart('chartKomposisi');
  const segVals=seg.map(r=>num(r['pelanggan bulanan (plg)']));const segTotal=segVals.reduce((a,b)=>a+(b||0),0);
  charts.chartKomposisi=new Chart($('chartKomposisi'),{type:'doughnut',data:{labels:seg.map(r=>clean(r.segment)),datasets:[{label:'Pelanggan',data:segVals,backgroundColor:[PALETTE.blue,PALETTE.teal],borderColor:'#fff',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'64%',layout:{padding:10},plugins:{legend:{position:'right',labels:{boxWidth:10,usePointStyle:true,font:{size:9}}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmtInt(c.raw)} pelanggan`}},valueLabels:{display:true,formatter:v=>segTotal?`${((v/segTotal)*100).toLocaleString('id-ID',{maximumFractionDigits:1})}%`:''}}}});
  charts.chartKomposisi.$downloadName='Komposisi_Pelanggan_Integrasi_vs_Non_Integrasi';charts.chartKomposisi.$csvRows=chartCsvRows(charts.chartKomposisi);

  const segSeries=(segment,metric,through,scale=1)=>MONTHS.slice(0,through).map((_,i)=>{const rs=DATA.integrasi.filter(r=>num(r.tahun)===2026&&num(r.bulan_no)===i+1&&clean(r.segment)===segment&&num(r[metric])!==null);return rs.length?rs.reduce((s,r)=>s+(num(r[metric])||0),0)/scale:null});
  const m8=num($('f8Month').value)||1,l8=MONTHS.slice(0,m8),i8=segSeries('INTEGRASI','pelanggan bulanan (plg)',m8),n8=segSeries('NON INTEGRASI','pelanggan bulanan (plg)',m8);
  makeChart('chartPlgIntegrasi','bar',l8,[{label:'Integrasi',data:i8,backgroundColor:PALETTE.blue,borderRadius:4},{label:'Non Integrasi',data:n8,backgroundColor:PALETTE.teal,borderRadius:4}],{tickCallback:fmtInt,labelFormatter:v=>v==null?'':fmtLabelInt(v),tooltipCallbacks:{label:c=>c.raw==null?'Belum ada data':`${c.dataset.label}: ${fmtInt(c.raw)}`},downloadName:'Pelanggan_Integrasi_vs_Non_Integrasi_2026'});

  const m9=num($('f9Month').value)||1,l9=MONTHS.slice(0,m9),i9=segSeries('INTEGRASI','penjualan bulanan (KWh)',m9,1e6),n9=segSeries('NON INTEGRASI','penjualan bulanan (KWh)',m9,1e6);
  makeChart('chartKwhIntegrasi','bar',l9,[{label:'Integrasi',data:i9,backgroundColor:PALETTE.blue,borderRadius:4},{label:'Non Integrasi',data:n9,backgroundColor:PALETTE.teal,borderRadius:4}],{tickCallback:fmtGWh,labelFormatter:v=>v==null?'':fmtLabelGWh(v),tooltipCallbacks:{label:c=>c.raw==null?'Belum ada data':`${c.dataset.label}: ${fmtGWh(c.raw)} GWh`},downloadName:'kWh_Integrasi_vs_Non_Integrasi_2026'});

  const m10=num($('f10Month').value)||1,l10=MONTHS.slice(0,m10);const tariff=(name)=>MONTHS.slice(0,m10).map((_,i)=>{const rs=DATA.diskon.filter(r=>num(r.tahun)===2026&&num(r.bulan_no)===i+1&&clean(r.segment_tarif)===name&&num(r['penjualan bulanan (kWh)'])!==null);return rs.length?rs.reduce((s,r)=>s+(num(r['penjualan bulanan (kWh)'])||0),0)/1e9:null});
  makeChart('chartDiskon','line',l10,[{label:'Diskon 30%',data:tariff('DISKON 30%'),borderColor:PALETTE.blue,backgroundColor:PALETTE.blue,tension:.25,pointRadius:3},{label:'Reguler',data:tariff('REGULER'),borderColor:PALETTE.teal,backgroundColor:PALETTE.teal,tension:.25,pointRadius:3}],{tickCallback:fmtGWh,labelFormatter:v=>v==null?'':fmtLabelGWh(v),tooltipCallbacks:{label:c=>c.raw==null?'Belum ada data':`${c.dataset.label}: ${fmtGWh(c.raw)} GWh`},downloadName:'kWh_Diskon_vs_Reguler_2026'});
}

function pivot(rows,rowKey,colKey,valueKey,colOrder,transform=v=>v){const names=[...new Set(rows.map(r=>clean(r[rowKey])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));const matrix={};names.forEach(n=>matrix[n]={});rows.forEach(r=>{const rn=clean(r[rowKey]),c=clean(r[colKey]),v=num(r[valueKey]);if(!rn||!c||v===null)return;matrix[rn][c]=(matrix[rn][c]||0)+transform(v)});return{names,matrix,cols:colOrder}}
function monthNoPivot(rows,rowKey,valueKey,transform=v=>v){
  const monthCols=Array.from({length:12},(_,i)=>String(i+1));
  const normalized=rows.map(r=>({...r,_bulan_no_key:num(r.bulan_no)?String(num(r.bulan_no)):''}));
  return pivot(normalized,rowKey,'_bulan_no_key',valueKey,monthCols,transform);
}
function tableCfg(type){
  if(type==='plgTahunan'){
    const ys=[...new Set(DATA.plgTahunan.map(r=>num(r.tahun)).filter(Boolean))].sort().map(String),p=pivot(DATA.plgTahunan.map(r=>({...r,tahun:String(r.tahun)})),'uid_uiw','tahun','penambahan plg tahunan (plg)',ys);
    return{title:'Pelanggan per UID/UIW per Tahun',subtitle:'UID/UIW ke bawah · tahun ke samping',headers:['UID/UIW',...ys],rows:p.names.map(u=>[u,...ys.map(y=>p.matrix[u][y]??0)]),fmt:'int'};
  }
  const rows=DATA.bulanan.filter(r=>num(r.tahun)===2026);
  if(type==='plgBulanan'){
    const p=monthNoPivot(rows,'uid_uiw','penambahan plg bulanan (plg)');
    return{title:'Pelanggan per UID/UIW per Bulan 2026',subtitle:'Data Tahun 2026 · acuan bulan_no · bulan kosong tetap kosong',headers:['UID/UIW',...MONTHS],rows:p.names.map(u=>[u,...p.cols.map(m=>Object.hasOwn(p.matrix[u],m)?p.matrix[u][m]:'')]),fmt:'int'};
  }
  if(type==='kwhBulanan'){
    const p=monthNoPivot(rows,'uid_uiw','penjualan bulanan (kWh)',v=>v/1e6);
    return{title:'kWh per UID/UIW per Bulan 2026',subtitle:'Data Tahun 2026 · acuan bulan_no · satuan GWh',headers:['UID/UIW',...MONTHS],rows:p.names.map(u=>[u,...p.cols.map(m=>Object.hasOwn(p.matrix[u],m)?p.matrix[u][m]:'')]),fmt:'gwh'};
  }
  const kr=DATA.kumulatif.filter(r=>num(r.tahun)===2026),p=monthNoPivot(kr,'uid_uiw','penjualan kumulatif (kWh)',v=>v/1e6);
  return{title:'kWh per UID/UIW Kumulatif 2026',subtitle:'Data Tahun 2026 · acuan bulan_no · satuan GWh',headers:['UID/UIW',...MONTHS],rows:p.names.map(u=>[u,...p.cols.map(m=>Object.hasOwn(p.matrix[u],m)?p.matrix[u][m]:'')]),fmt:'gwh'};
}
function filteredTableRows(c){const q=clean($('tableSearch').value).toLowerCase();return c.rows.filter(r=>!q||String(r[0]).toLowerCase().includes(q))}
function renderTable(){
  const c=tableCfg(activeTable);$('activeTableTitle').textContent=c.title;$('activeTableSubtitle').textContent=c.subtitle;
  const rows=filteredTableRows(c);$('dataTableHead').innerHTML=`<tr>${c.headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
  const totals=new Array(c.headers.length).fill(0),used=new Array(c.headers.length).fill(false);
  let body=rows.map(r=>`<tr>${r.map((v,i)=>{if(i>0&&v!==''){totals[i]+=Number(v);used[i]=true}const t=i===0?v:(v===''?'':c.fmt==='gwh'?fmtGWh(v):fmtInt(v));return`<td>${t}</td>`}).join('')}</tr>`).join('');
  body+=`<tr class="total-row"><td>TOTAL NASIONAL</td>${totals.slice(1).map((v,i)=>used[i+1]?`<td>${c.fmt==='gwh'?fmtGWh(v):fmtInt(v)}</td>`:'<td></td>').join('')}</tr>`;$('dataTableBody').innerHTML=body;
}
function csvBlob(rows){const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n');return new Blob([csv],{type:'text/csv;charset=utf-8'})}
function triggerBlobDownload(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function downloadChartPNG(id){
  const c=charts[id];if(!c)return;
  const src=c.canvas,scale=2,canvas=document.createElement('canvas');canvas.width=src.width*scale;canvas.height=src.height*scale;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(scale,scale);ctx.drawImage(src,0,0);
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png',1);a.download=(c.$downloadName||id)+'.png';a.click();
}
function downloadChartXLSX(id){
  const c=charts[id];if(!c)return;
  const rows=c.$csvRows||chartCsvRows(c);
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=(rows[0]||[]).map((_,col)=>({wch:Math.min(28,Math.max(12,...rows.map(r=>String(r[col]??'').length+2)))}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Data Grafik');
  XLSX.writeFile(wb,(c.$downloadName||id)+'.xlsx');
}
function exportCSV(){const c=tableCfg(activeTable),rows=[c.headers,...filteredTableRows(c)];triggerBlobDownload(csvBlob(rows),c.title.replace(/[^a-z0-9]+/gi,'_')+'.csv')}
function exportXLSX(){const c=tableCfg(activeTable),rows=[c.headers,...filteredTableRows(c)];const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Data');XLSX.writeFile(wb,c.title.replace(/[^a-z0-9]+/gi,'_')+'.xlsx')}
function renderAll(){renderKPI();renderCharts();renderTable()}
function bind(){
  document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.target).scrollIntoView({behavior:'smooth'})});
  document.querySelectorAll('.table-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.table-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeTable=b.dataset.table;renderTable()});
  document.querySelectorAll('.download-chart').forEach(b=>b.onclick=()=>downloadChartPNG(b.dataset.chart));
  document.querySelectorAll('.download-chart-xlsx').forEach(b=>b.onclick=()=>downloadChartXLSX(b.dataset.chart));
  $('exportCsv').onclick=exportCSV;$('exportXlsx').onclick=exportXLSX;$('tableSearch').oninput=renderTable;$('refreshBtn').onclick=()=>loadDatabase().catch(showError);
  $('logoutBtn').onclick=logout;
  ['f1UID','f2UID','f2Month','f4UID','f4Month','f5UID','f5Month','f6UID','f6Month','f7Month','f8Month','f9Month','f10Month'].forEach(id=>$(id).onchange=renderCharts);
}
function showError(e){console.error(e);$('dbStatus').textContent='● Database belum tersedia';$('dbStatus').style.color='#ffd8d8';alert('Dashboard belum dapat membaca Google Sheet Master.\n\n'+e.message)}
function isLoggedIn(){return sessionStorage.getItem('hcs_authenticated')==='true'}
function showDashboard(){
  $('loginScreen').classList.add('is-hidden');$('dashboardApp').classList.remove('is-hidden');
  loadDatabase().catch(showError);
}
function logout(){sessionStorage.removeItem('hcs_authenticated');location.reload()}
function bindLogin(){
  $('loginForm').onsubmit=e=>{
    e.preventDefault();
    const ok=$('loginUsername').value===APP_CONFIG.LOGIN_USERNAME&&$('loginPassword').value===APP_CONFIG.LOGIN_PASSWORD;
    if(!ok){$('loginError').textContent='Username atau password tidak sesuai.';return}
    sessionStorage.setItem('hcs_authenticated','true');$('loginError').textContent='';showDashboard();
  };
}
document.addEventListener('DOMContentLoaded',()=>{bind();bindLogin();if(isLoggedIn())showDashboard()});
