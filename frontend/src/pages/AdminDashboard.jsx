import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, UserCheck, ShieldAlert, FileSpreadsheet, 
  Search, Filter, Sliders, FileText, Download, Upload, 
  ChevronLeft, ChevronRight, X, Lock, Check, CheckSquare, 
  AlertTriangle, RefreshCw, Save, HelpCircle, Server, DollarSign
} from 'lucide-react';
import MonthDropdown from '../components/MonthDropdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType, ImageRun, BorderStyle } from 'docx';
import PptxGenJS from 'pptxgenjs';

/* ═══════════════════════════════════════════════════
   3D PIE CHART COMPONENT — SVG-based with depth effect
   ═══════════════════════════════════════════════════ */
// ─── PURE RENDER COMPONENT ────────────────────────────────────────────────────
// ThreeDPieChart is a PURE function of its props.
//   ✔ No internal data state — data flows directly from props to SVG render
//   ✔ No useEffect with data dependency — SVG is rebuilt on every render
//   ✔ No stale closures — all geometry computed inline from current `data`
//   ✔ hoveredIndex / tooltip are UI-only interaction state, NOT data caches
//   ✔ Parent drives re-mount via chartKey when analyticsData changes
// ─────────────────────────────────────────────────────────────────────────────
const ThreeDPieChart = ({ title, data, subtitle }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  // ── Safety guard — never crash on null/undefined data prop ──
  if (!data || !data.length) return null;

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  // 3D pie geometry constants
  const CX = 110, CY = 88, RX = 88, RY = 48, DEPTH = 28;

  const toRad = (deg) => (deg * Math.PI) / 180;

  // Convert polar angle to ellipse (x,y) on top face
  const pt = (angle) => ({
    x: CX + RX * Math.cos(toRad(angle)),
    y: CY + RY * Math.sin(toRad(angle))
  });
  // Same but on bottom face (offset by DEPTH)
  const pb = (angle) => ({
    x: CX + RX * Math.cos(toRad(angle)),
    y: CY + RY * Math.sin(toRad(angle)) + DEPTH
  });

  // Build slices
  let slices = [];
  if (total > 0) {
    let cumAngle = -90; // start at top
    slices = data.map((item, idx) => {
      const pct = item.value / total;
      const sweep = pct * 360;
      const startA = cumAngle;
      const endA = cumAngle + sweep;
      cumAngle += sweep;
      return { ...item, pct, sweep, startA, endA, idx };
    });
  }

  const buildTopPath = (s) => {
    const { startA, endA } = s;
    if (Math.abs(s.sweep) < 0.01) return '';
    const large = s.sweep > 180 ? 1 : 0;
    const p1 = pt(startA), p2 = pt(endA);
    return `M ${CX},${CY} L ${p1.x},${p1.y} A ${RX},${RY} 0 ${large} 1 ${p2.x},${p2.y} Z`;
  };

  const buildSidePath = (s) => {
    const { startA, endA } = s;
    if (Math.abs(s.sweep) < 0.01) return '';
    // Only draw side for angles that face downward (180..360 or 0..180 mapped)
    // We draw left-side and right-side walls; just do the full boundary
    const large = s.sweep > 180 ? 1 : 0;
    const p1t = pt(startA), p2t = pt(endA);
    const p1b = pb(startA), p2b = pb(endA);
    return [
      `M ${p1t.x},${p1t.y}`,
      `A ${RX},${RY} 0 ${large} 1 ${p2t.x},${p2t.y}`,
      `L ${p2b.x},${p2b.y}`,
      `A ${RX},${RY} 0 ${large} 0 ${p1b.x},${p1b.y}`,
      'Z'
    ].join(' ');
  };

  const buildBottomEllipsePath = () =>
    `M ${CX - RX},${CY + DEPTH} A ${RX},${RY} 0 1 0 ${CX + RX},${CY + DEPTH} A ${RX},${RY} 0 1 0 ${CX - RX},${CY + DEPTH} Z`;

  // Compute lightened / darkened shade for sides
  const darken = (hex, amt = 40) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return `rgb(${r},${g},${b})`;
  };

  // Parse hsl() or rgb() strings for darkening; fallback gracefully
  const sideColor = (color) => {
    if (color.startsWith('#')) return darken(color, 40);
    // For hsl strings, just add brightness reduction via filter trick: use opacity
    return color;
  };

  const noData = total === 0;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        minHeight: '340px',
        background: 'linear-gradient(135deg, rgba(20,18,55,0.95) 0%, rgba(15,12,45,0.98) 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        overflow: 'hidden'
      }}
    >
      {/* Decorative corner glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
        background: 'radial-gradient(circle at top right, rgba(99,102,241,0.15), transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Title */}
      <div style={{ alignSelf: 'flex-start', marginBottom: '4px' }}>
        <h4 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '700', margin: 0, letterSpacing: '0.01em' }}>{title}</h4>
        {subtitle && <p style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', margin: '3px 0 0', letterSpacing: '0.03em' }}>{subtitle}</p>}
      </div>

      {/* Chart */}
      {noData ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <svg width="220" height="120" viewBox="0 0 220 120">
            <ellipse cx="110" cy="76" rx="88" ry="20" fill="rgba(99,102,241,0.06)" />
            <ellipse cx="110" cy="56" rx="88" ry="48" fill="rgba(30,27,90,0.5)" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
          </svg>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.82rem', marginTop: '-8px' }}>No data available</p>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '220px', marginTop: '6px' }}>
          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: 'absolute',
              top: tooltip.y,
              left: tooltip.x,
              background: 'rgba(10,8,40,0.95)',
              border: `1px solid ${tooltip.color}55`,
              borderRadius: '8px',
              padding: '7px 12px',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${tooltip.color}33`,
              minWidth: '110px',
              transform: 'translate(-50%, -110%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: tooltip.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: '600' }}>{tooltip.label}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: tooltip.color, fontWeight: '700' }}>
                {tooltip.value} <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '400' }}>({tooltip.pct}%)</span>
              </div>
            </div>
          )}

          <svg
            width="220"
            height="155"
            viewBox="0 0 220 155"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <filter id={`shadow-${title.replace(/\s/g,'')}`} x="-20%" y="-20%" width="160%" height="200%">
                <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.6" />
              </filter>
              <radialGradient id={`gloss-${title.replace(/\s/g,'')}`} cx="38%" cy="28%" r="55%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.1" />
              </radialGradient>
            </defs>

            {/* Bottom base shadow */}
            <ellipse cx={CX} cy={CY + DEPTH + 6} rx={RX} ry={12} fill="rgba(0,0,0,0.35)" />

            {/* Side walls — painted first (back to front) */}
            {slices.map((s) => (
              <path
                key={`side-${s.idx}`}
                d={buildSidePath(s)}
                fill={s.color}
                style={{ opacity: hoveredIndex === s.idx ? 0.75 : 0.45, transition: 'opacity 0.25s' }}
              />
            ))}

            {/* Top faces */}
            {slices.map((s) => {
              const isHov = hoveredIndex === s.idx;
              return (
                <g
                  key={`top-${s.idx}`}
                  style={{
                    transform: isHov ? `translate(0px, -5px)` : 'translate(0,0)',
                    transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                    cursor: 'pointer',
                    filter: isHov ? `drop-shadow(0 0 8px ${s.color}99)` : 'none'
                  }}
                  onMouseEnter={(e) => {
                    setHoveredIndex(s.idx);
                    const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                    const midA = (s.startA + s.endA) / 2;
                    const mx = CX + RX * 0.5 * Math.cos(toRad(midA));
                    const my = CY + RY * 0.5 * Math.sin(toRad(midA));
                    setTooltip({ x: mx, y: my - 4, label: s.label, value: s.value, pct: Math.round(s.pct * 100), color: s.color });
                  }}
                  onMouseLeave={() => { setHoveredIndex(null); setTooltip(null); }}
                >
                  <path
                    d={buildTopPath(s)}
                    fill={s.color}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="0.8"
                  />
                  {/* Gloss overlay per slice */}
                  <path
                    d={buildTopPath(s)}
                    fill={`url(#gloss-${title.replace(/\s/g,'')})`}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}

            {/* Centre total label */}
            <text x={CX} y={CY - 4} textAnchor="middle" style={{ fill: '#fff', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>{total}</text>
            <text x={CX} y={CY + 10} textAnchor="middle" style={{ fill: 'rgba(255,255,255,0.45)', fontSize: '7.5px', textTransform: 'uppercase', fontFamily: 'inherit' }}>Total</text>
          </svg>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%', marginTop: '12px' }}>
        {data.map((item, idx) => {
          const isHov = hoveredIndex === idx;
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px', borderRadius: '7px',
                background: isHov ? `${item.color}18` : 'transparent',
                border: isHov ? `1px solid ${item.color}40` : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '3px',
                  background: item.color,
                  boxShadow: isHov ? `0 0 6px ${item.color}` : 'none',
                  transition: 'box-shadow 0.2s',
                  flexShrink: 0
                }} />
                <span style={{ fontSize: '0.76rem', color: isHov ? '#fff' : 'hsl(var(--text-secondary))', fontWeight: isHov ? '600' : '400', transition: 'color 0.2s' }}>
                  {item.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: `${Math.max(pct, 2)}px`, maxWidth: '60px', height: '4px',
                  background: item.color, borderRadius: '2px', opacity: 0.7,
                  transition: 'width 0.4s ease'
                }} />
                <span style={{ fontSize: '0.76rem', fontWeight: '700', color: isHov ? item.color : 'hsl(var(--text-primary))', minWidth: '56px', textAlign: 'right', transition: 'color 0.2s' }}>
                  {item.value} <span style={{ opacity: 0.55, fontWeight: '400' }}>({pct}%)</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminDashboard = ({ setView }) => {
  const { token, logout, showToast, API_URL } = useAuth();
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('overview'); // overview, students, requests, reports, integration
  
  // Student List & Filtering States
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({
    utNo: '',
    name: '',
    phoneNo: '',
    beneficiaryName: '',
    bank: '',
    studentType: 'blossom',
    courseName: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  // Selected Student Drawer
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminFieldInputs, setAdminFieldInputs] = useState({
    adminCol1Val: '',
    adminCol2Val: '',
    adminCol3Val: 0,
    blossomTrustAmount: 0,
    isDropout: false,
    dropoutReason: '',
    dropoutDate: '',
    isLowAlternance: false,
    lowAlternanceReason: '',
    lowAlternanceHours: '',
    courseSpecialization: '',
    employmentStatus: '',
    otherStatus: '',
    courseCompletionStatus: '',
    email: ''
  });
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Edit Requests State
  const [editRequests, setEditRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Admin Custom Column Settings
  const [settings, setSettings] = useState({
    admin_col1_title: 'Current Status',
    admin_col2_title: 'Working Company Name',
    admin_col3_title: 'Salary (LKR)',
    google_sheets_id: '',
    google_sheets_client_email: '',
    google_sheets_private_key: ''
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    adminCol1Title: '',
    adminCol2Title: '',
    adminCol3Title: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // File Upload State
  const [excelFile, setExcelFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Attendance Upload State
  const [attendanceFile, setAttendanceFile] = useState(null);
  const [attendanceMonth, setAttendanceMonth] = useState('January');
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear().toString());
  const [attendanceThreshold, setAttendanceThreshold] = useState('80');
  const [attendanceUploadLoading, setAttendanceUploadLoading] = useState(false);

  // Reports State
  const [reportMonth, setReportMonth] = useState('');
  const [dropoutMonth, setDropoutMonth] = useState('');
  const [reportThreshold, setReportThreshold] = useState('80');
  const [reportBatch, setReportBatch] = useState('');
  const [reportBatchYear, setReportBatchYear] = useState('');

  // Integration Sheets Settings
  const [sheetsForm, setSheetsForm] = useState({
    googleSheetsId: '',
    googleSheetsClientEmail: '',
    googleSheetsPrivateKey: ''
  });
  const [syncLoading, setSyncLoading] = useState(false);

  // Stats State
  const [stats, setStats] = useState({
    total: 0,
    pendingRequests: 0,
    dropouts: 0,
    lowAlternance: 0,
    completedCount: 0,
    dropoutCount: 0,
    courseSplits: {},
    employmentStatus: {},
    studentTypeSplits: {},
    courseSpecialization: {},
    employmentStatusNew: {},
    otherStatus: {}
  });

  // Analytics Chart State (for 3D Pie Chart section)
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFilter, setAnalyticsFilter] = useState({ mode: 'all', year: new Date().getFullYear().toString(), month: '' });
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const analyticsChartRef = useRef(null);


  // ─── Export Helpers ───────────────────────────────────────────────────────

  const getFilterLabel = () => {
    if (analyticsFilter.mode === 'yearly') return `Year ${analyticsFilter.year}`;
    if (analyticsFilter.mode === 'monthly' && analyticsFilter.month) {
      const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return `${names[parseInt(analyticsFilter.month) - 1]} ${analyticsFilter.year}`;
    }
    return 'All Time';
  };

  const buildChartDatasets = () => {
    // Safety-destructure each dataset from the flat root — never crash if null
    const dropout      = analyticsData?.dropoutStatus;
    const completion   = analyticsData?.courseCompletionStatus;
    const employment   = analyticsData?.employmentStatus;
    const other        = analyticsData?.otherStatus;
    const types        = analyticsData?.studentTypes;
    const specializ    = analyticsData?.courseSpecialization;

    return [
      {
        title: 'Dropout Status',
        rows: [
                    { label: 'Active Students', value: dropout?.active ?? 0, color: '#22c55e' },
          { label: 'Dropped Out',     value: dropout?.dropped ?? 0, color: '#ef4444' },
        ]
      },
      {
        title: 'Course Completion',
        rows: [
                    { label: 'Completed',   value: completion?.completed ?? 0,  color: '#6366f1' },
          { label: 'In Progress', value: completion?.inProgress ?? 0, color: '#f59e0b' },
          { label: 'Not Started', value: completion?.notStarted ?? 0, color: '#94a3b8' },
        ]
      },
      {
        title: 'Employment Status',
        rows: [
                    { label: 'Software Industry', value: employment?.software ?? 0, color: '#06b6d4' },
          { label: 'Other Industry',    value: employment?.other ?? 0, color: '#8b5cf6' },
        ]
      },
      {
        title: 'Other Status',
        rows: [
                    { label: 'Higher Study',  value: other?.higherStudy ?? 0, color: '#3b82f6' },
          { label: 'Unemployment',  value: other?.unemployment ?? 0, color: '#f97316' },
          { label: 'Foreign',       value: other?.foreign ?? 0, color: '#10b981' },
        ]
      },
      {
        title: 'Student Type Split',
        rows: [
                    { label: 'Blossom Trust', value: types?.blossom ?? 0, color: '#ec4899' },
          { label: 'Non-Blossom',   value: types?.nonBlossom ?? 0, color: '#06b6d4' },
        ]
      },
      {
        title: 'Course Specialization',
        rows: [
                    { label: 'Full Stack Dev', value: specializ?.fullStack ?? 0, color: '#a78bfa' },
          { label: 'Front End Dev',  value: specializ?.frontEnd ?? 0, color: '#34d399' },
        ]
      },
    ];
  };

  // Capture chart grid as canvas → returns dataURL
  const captureChartCanvas = async () => {
    if (!analyticsChartRef.current) throw new Error('Chart container not found');
    const canvas = await html2canvas(analyticsChartRef.current, {
      backgroundColor: '#0f0c2d',
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true
    });
    return { canvas, dataURL: canvas.toDataURL('image/png', 1.0) };
  };

  // ── 1. Export as PNG Image ────────────────────────────────────────────────
  const exportAsImage = async () => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const { dataURL } = await captureChartCanvas();
      const link = document.createElement('a');
      link.download = `Analytics_${getFilterLabel().replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.png`;
      link.href = dataURL;
      link.click();
      showToast('Chart exported as PNG image!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export image.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // ── 2. Export as PDF ──────────────────────────────────────────────────────
  const exportAsPDF = async () => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const { canvas } = await captureChartCanvas();
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // ── Header bar ──
      pdf.setFillColor(26, 22, 90);
      pdf.rect(0, 0, pageW, 22, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Blossom Trust — Student Repository Analytics', 14, 14);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(180, 180, 220);
      pdf.text(`Filter: ${getFilterLabel()}   |   Generated: ${new Date().toLocaleString()}   |   Total Students: ${analyticsData?.total ?? 0}`, 14, 19.5);

      // ── Chart image ──
      const imgW = pageW - 28;
      const imgH = (canvas.height / canvas.width) * imgW;
      const maxChartH = pageH - 75;
      const finalH = Math.min(imgH, maxChartH);
      pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 14, 26, imgW, finalH);

      // ── Summary table ──
      let tableY = 26 + finalH + 8;
      if (tableY > pageH - 40) { pdf.addPage(); tableY = 14; }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.setFillColor(99, 102, 241);
      pdf.rect(14, tableY, pageW - 28, 7, 'F');
      pdf.text('Category', 17, tableY + 5);
      pdf.text('Label', 70, tableY + 5);
      pdf.text('Count', 150, tableY + 5);
      pdf.text('Percentage', 185, tableY + 5);
      tableY += 7;

      const datasets = buildChartDatasets();
      let rowIdx = 0;
      datasets.forEach(ds => {
        const total = ds.rows.reduce((s, r) => s + r.value, 0);
        ds.rows.forEach(row => {
          const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0';
          pdf.setFillColor(rowIdx % 2 === 0 ? 245 : 252, rowIdx % 2 === 0 ? 244 : 251, rowIdx % 2 === 0 ? 255 : 255);
          pdf.rect(14, tableY, pageW - 28, 6, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(60, 50, 130);
          pdf.text(ds.title, 17, tableY + 4.2);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(40, 40, 80);
          pdf.text(row.label, 70, tableY + 4.2);
          pdf.text(String(row.value), 150, tableY + 4.2);
          pdf.text(`${pct}%`, 185, tableY + 4.2);
          tableY += 6;
          rowIdx++;
          if (tableY > pageH - 14) { pdf.addPage(); tableY = 14; }
        });
      });

      // ── Footer ──
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(150, 140, 190);
        pdf.text(`Page ${i} of ${totalPages}  |  Blossom Trust Reporting Portal`, 14, pageH - 4);
      }

      pdf.save(`Analytics_Report_${getFilterLabel().replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('PDF report downloaded!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export PDF.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // ── 3. Export as Word (DOCX) ──────────────────────────────────────────────
  const exportAsWord = async () => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const { canvas } = await captureChartCanvas();
      const pngDataUrl = canvas.toDataURL('image/png', 1.0);
      // Convert base64 dataURL → ArrayBuffer for docx ImageRun
      const base64 = pngDataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const imgBuffer = bytes.buffer;

      const datasets = buildChartDatasets();
      const filterLabel = getFilterLabel();
      const now = new Date().toLocaleString();

      // ── Table rows ──
      const headerRow = new TableRow({
        tableHeader: true,
        children: ['Category', 'Label', 'Count', 'Percentage'].map(txt =>
          new TableCell({
            shading: { fill: '6366F1' },
            children: [new Paragraph({ children: [new TextRun({ text: txt, bold: true, color: 'FFFFFF', size: 20 })], alignment: AlignmentType.CENTER })],
            width: { size: 25, type: WidthType.PERCENTAGE },
          })
        )
      });

      const dataRows = [];
      let rowIdx = 0;
      datasets.forEach(ds => {
        const total = ds.rows.reduce((s, r) => s + r.value, 0);
        ds.rows.forEach(row => {
          const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0';
          const fillColor = rowIdx % 2 === 0 ? 'F5F4FF' : 'FAFBFF';
          dataRows.push(new TableRow({
            children: [
              new TableCell({ shading: { fill: fillColor }, children: [new Paragraph({ children: [new TextRun({ text: ds.title, bold: true, size: 18, color: '3C3282' })], alignment: AlignmentType.LEFT })], width: { size: 25, type: WidthType.PERCENTAGE } }),
              new TableCell({ shading: { fill: fillColor }, children: [new Paragraph({ children: [new TextRun({ text: row.label, size: 18 })] })], width: { size: 35, type: WidthType.PERCENTAGE } }),
              new TableCell({ shading: { fill: fillColor }, children: [new Paragraph({ children: [new TextRun({ text: String(row.value), size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
              new TableCell({ shading: { fill: fillColor }, children: [new Paragraph({ children: [new TextRun({ text: `${pct}%`, size: 18, bold: true })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            ]
          }));
          rowIdx++;
        });
      });

      const imgAspect = canvas.height / canvas.width;
      const imgWidthEMU = 8000000; // ~8.8 cm in EMU (1 cm = 914400 EMU)
      const imgHeightEMU = Math.round(imgWidthEMU * imgAspect);

      const doc = new Document({
        styles: {
          default: { document: { run: { font: 'Calibri', size: 20 } } }
        },
        sections: [{
          properties: { page: { size: { orientation: 'landscape' } } },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: 'Student Repository Analytics', bold: true, size: 36, color: '1A165A' })],
              spacing: { after: 80 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Blossom Trust Reporting Portal  |  ', size: 20, color: '6366F1' }),
                new TextRun({ text: `Filter: ${filterLabel}`, size: 20, bold: true }),
                new TextRun({ text: `  |  Total Students: ${analyticsData?.total ?? 0}`, size: 20 }),
                new TextRun({ text: `  |  Generated: ${now}`, size: 18, color: '888888' }),
              ],
              spacing: { after: 240 }
            }),
            // Embedded chart image
            new Paragraph({
              children: [new ImageRun({ data: imgBuffer, transformation: { width: Math.round(imgWidthEMU / 9144), height: Math.round(imgHeightEMU / 9144) }, type: 'png' })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 360 }
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Analytics Summary Table', bold: true, size: 26, color: '1A165A' })],
              spacing: { before: 120, after: 120 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow, ...dataRows],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Report generated by Blossom Trust Reporting Portal on ${now}`, size: 16, color: 'AAAAAA', italics: true })],
              spacing: { before: 480 },
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Analytics_Report_${filterLabel.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Word document downloaded!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export Word document.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // ── 4. Export as PowerPoint (PPTX) ───────────────────────────────────────
  const exportAsPPTX = async () => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const filterLabel = getFilterLabel();
      const now = new Date().toLocaleString();
      const datasets = buildChartDatasets();

      // ── Capture chart canvas ──
      const { canvas } = await captureChartCanvas();
      const chartDataURL = canvas.toDataURL('image/png', 1.0);

      // ── Helper: build per-chart pie canvas data URLs ──
      // We render each individual SVG pie to a temporary off-screen canvas
      // for slide-level chart images (one per category per slide).
      // Falls back to the full grid capture if individual capture fails.

      // Determine slide structure based on filter mode
      // Monthly → each month in selected year = one slide
      // Yearly  → each available year = one slide (grouped)
      // All     → single slide per category (6 slides total, one per dataset)
      // Current filter → always one "Overview" slide + one slide per dataset

      const MONTH_NAMES = ['January','February','March','April','May','June',
                           'July','August','September','October','November','December'];

      // Build slide definitions
      let slideGroups = [];

      if (analyticsFilter.mode === 'monthly' && analyticsFilter.month) {
        // Single specific month selected
        slideGroups = [{ label: filterLabel, datasets }];
      } else if (analyticsFilter.mode === 'monthly' && !analyticsFilter.month) {
        // All months of selected year — one slide per month
        slideGroups = MONTH_NAMES.map((mName, idx) => ({
          label: `${mName} ${analyticsFilter.year}`,
          datasets // same current data shown per slide (live data is already filtered to year)
        }));
        // Collapse to just the current data on a single "full-year" slide
        slideGroups = [{ label: `All Months — ${analyticsFilter.year}`, datasets }];
      } else if (analyticsFilter.mode === 'yearly') {
        slideGroups = [{ label: `Year ${analyticsFilter.year}`, datasets }];
      } else {
        // All time
        slideGroups = [{ label: 'All Time', datasets }];
      }

      // ── Create PPTX ──
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE'; // 33.867 x 19.05 cm (16:9)

      // Brand colour constants (hex, no #)
      const BRAND_DARK   = '0F0C2D';
      const BRAND_PURPLE = '6366F1';
      const BRAND_ACCENT = '10B981';
      const WHITE        = 'FFFFFF';
      const LIGHT_GRAY   = 'E5E7EB';
      const TEXT_DARK    = '1E1B4B';
      const TEXT_MUTED   = '6B7280';

      // ── Slide master background helper ──
      const applySlideBackground = (slide) => {
        // Dark gradient background
        slide.background = { fill: BRAND_DARK };
        // Top header strip
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: 1.0,
          fill: { color: '1A165A' },
          line: { color: '1A165A', width: 0 }
        });
        // Accent bottom stripe
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 6.9, w: '100%', h: 0.15,
          fill: { color: BRAND_PURPLE },
          line: { color: BRAND_PURPLE, width: 0 }
        });
        // Decorative corner circle
        slide.addShape(pptx.ShapeType.ellipse, {
          x: 11.8, y: -0.6, w: 1.8, h: 1.8,
          fill: { color: BRAND_PURPLE, transparency: 85 },
          line: { color: BRAND_PURPLE, transparency: 70, width: 1 }
        });
      };

      // ── Header text helper ──
      const addSlideHeader = (slide, titleSuffix, filterStr) => {
        // Logo text / brand
        slide.addText('🌸 Blossom Trust', {
          x: 0.3, y: 0.08, w: 4, h: 0.4,
          fontSize: 11, bold: true, color: BRAND_ACCENT,
          fontFace: 'Calibri'
        });
        // Main title
        slide.addText('Student Repository Analytics', {
          x: 0.3, y: 0.35, w: 8, h: 0.45,
          fontSize: 18, bold: true, color: WHITE,
          fontFace: 'Calibri'
        });
        // Filter label right-aligned in header
        slide.addText(`Filter: ${filterStr}`, {
          x: 8.5, y: 0.1, w: 5.0, h: 0.35,
          fontSize: 9, color: 'A5B4FC',
          align: 'right', fontFace: 'Calibri'
        });
        // Generated timestamp
        slide.addText(`Generated: ${now}`, {
          x: 8.5, y: 0.42, w: 5.0, h: 0.28,
          fontSize: 8, color: '818CF8',
          align: 'right', fontFace: 'Calibri'
        });
        // Section divider line
        slide.addShape(pptx.ShapeType.line, {
          x: 0.3, y: 0.95, w: 13.07, h: 0,
          line: { color: BRAND_PURPLE, width: 1, transparency: 40 }
        });
      };

      // ── Footer helper ──
      const addSlideFooter = (slide, pageNum, totalSlides) => {
        slide.addText(
          `Blossom Trust Reporting Portal  |  Page ${pageNum} of ${totalSlides}  |  ${now}`,
          {
            x: 0.3, y: 7.0, w: 13.07, h: 0.28,
            fontSize: 7, color: '4B5563',
            align: 'center', fontFace: 'Calibri'
          }
        );
      };

      // ────────────────────────────────────────────────────────────────────
      // SLIDE 1: Cover / Overview slide
      // ────────────────────────────────────────────────────────────────────
      const coverSlide = pptx.addSlide();
      coverSlide.background = { fill: BRAND_DARK };
      // Full-width accent gradient strip
      coverSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { type: 'solid', color: BRAND_DARK },
        line: { color: BRAND_DARK, width: 0 }
      });
      // Purple left bar
      coverSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.25, h: '100%',
        fill: { color: BRAND_PURPLE },
        line: { color: BRAND_PURPLE, width: 0 }
      });
      // Large decorative circle
      coverSlide.addShape(pptx.ShapeType.ellipse, {
        x: 9.5, y: -1, w: 5, h: 5,
        fill: { color: BRAND_PURPLE, transparency: 90 },
        line: { color: BRAND_PURPLE, transparency: 80, width: 1 }
      });
      coverSlide.addShape(pptx.ShapeType.ellipse, {
        x: 10.5, y: 3.5, w: 3.5, h: 3.5,
        fill: { color: BRAND_ACCENT, transparency: 93 },
        line: { color: BRAND_ACCENT, transparency: 85, width: 1 }
      });

      // Blossom Trust brand
      coverSlide.addText('🌸  BLOSSOM TRUST', {
        x: 0.7, y: 1.4, w: 9, h: 0.6,
        fontSize: 16, bold: true, color: BRAND_ACCENT,
        fontFace: 'Calibri', charSpacing: 4
      });
      // Main title
      coverSlide.addText('Student Repository\nAnalytics Report', {
        x: 0.7, y: 2.0, w: 10, h: 1.6,
        fontSize: 36, bold: true, color: WHITE,
        fontFace: 'Calibri', lineSpacingMultiple: 1.15
      });
      // Filter info
      coverSlide.addText(`Filter: ${filterLabel}`, {
        x: 0.7, y: 3.8, w: 8, h: 0.45,
        fontSize: 14, color: 'A5B4FC',
        fontFace: 'Calibri'
      });
      // Total students badge
      coverSlide.addShape(pptx.ShapeType.rect, {
        x: 0.7, y: 4.35, w: 3.2, h: 0.65,
        fill: { color: BRAND_PURPLE, transparency: 70 },
        line: { color: BRAND_PURPLE, transparency: 30, width: 1 },
        rectRadius: 0.12
      });
      coverSlide.addText(`📊  Total Students: ${analyticsData?.total ?? 0}`, {
        x: 0.7, y: 4.35, w: 3.2, h: 0.65,
        fontSize: 11, bold: true, color: WHITE,
        align: 'center', fontFace: 'Calibri'
      });
      // Generated date
      coverSlide.addText(`Generated on ${now}`, {
        x: 0.7, y: 6.4, w: 8, h: 0.35,
        fontSize: 9, color: TEXT_MUTED, fontFace: 'Calibri'
      });
      // Bottom accent bar
      coverSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 6.85, w: '100%', h: 0.2,
        fill: { color: BRAND_PURPLE },
        line: { color: BRAND_PURPLE, width: 0 }
      });

      // ────────────────────────────────────────────────────────────────────
      // SLIDE 2: Full chart grid snapshot
      // ────────────────────────────────────────────────────────────────────
      const chartSlide = pptx.addSlide();
      applySlideBackground(chartSlide);
      addSlideHeader(chartSlide, '', filterLabel);

      chartSlide.addText('Analytics Overview — All Charts', {
        x: 0.3, y: 1.05, w: 13.07, h: 0.45,
        fontSize: 15, bold: true, color: WHITE,
        fontFace: 'Calibri'
      });
      chartSlide.addText(`Total Students: ${analyticsData?.total ?? 0}`, {
        x: 0.3, y: 1.48, w: 4, h: 0.28,
        fontSize: 9, color: BRAND_ACCENT, fontFace: 'Calibri'
      });

      // Embed full chart grid image
      chartSlide.addImage({
        data: chartDataURL,
        x: 0.3, y: 1.85, w: 13.07, h: 4.9,
        sizing: { type: 'contain', w: 13.07, h: 4.9 }
      });

      // ────────────────────────────────────────────────────────────────────
      // SLIDES 3–8: One slide per dataset category
      // ────────────────────────────────────────────────────────────────────
      const categorySlides = datasets.map((ds, dsIdx) => {
        const slide = pptx.addSlide();
        applySlideBackground(slide);
        addSlideHeader(slide, ds.title, filterLabel);

        const dsTotal = ds.rows.reduce((s, r) => s + r.value, 0);

        // Category label pill
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.3, y: 1.05, w: 3.5, h: 0.42,
          fill: { color: BRAND_PURPLE, transparency: 65 },
          line: { color: BRAND_PURPLE, transparency: 20, width: 1 },
          rectRadius: 0.1
        });
        slide.addText(ds.title, {
          x: 0.3, y: 1.05, w: 3.5, h: 0.42,
          fontSize: 12, bold: true, color: WHITE,
          align: 'center', fontFace: 'Calibri'
        });

        // Total for this category
        slide.addText(`Total: ${dsTotal} students`, {
          x: 4.1, y: 1.12, w: 3, h: 0.3,
          fontSize: 9, color: BRAND_ACCENT, fontFace: 'Calibri'
        });

        // ── Chart image on left (full grid, cropped feel) ──
        slide.addImage({
          data: chartDataURL,
          x: 0.3, y: 1.6, w: 6.5, h: 5.1,
          sizing: { type: 'contain', w: 6.5, h: 5.1 }
        });

        // ── Summary table on right ──
        const tableX = 7.1;
        const tableTop = 1.55;
        const rowH = 0.42;
        const tableW = 6.2;

        // Table header background
        slide.addShape(pptx.ShapeType.rect, {
          x: tableX, y: tableTop, w: tableW, h: rowH,
          fill: { color: BRAND_PURPLE },
          line: { color: BRAND_PURPLE, width: 0 },
          rectRadius: 0
        });
        // Table header text
        slide.addText('Category', { x: tableX + 0.1, y: tableTop + 0.05, w: 2.4, h: rowH - 0.1, fontSize: 9, bold: true, color: WHITE, fontFace: 'Calibri' });
        slide.addText('Count',    { x: tableX + 2.5, y: tableTop + 0.05, w: 1.7, h: rowH - 0.1, fontSize: 9, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri' });
        slide.addText('%',        { x: tableX + 4.2, y: tableTop + 0.05, w: 2.0, h: rowH - 0.1, fontSize: 9, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri' });

        ds.rows.forEach((row, rIdx) => {
          const pct = dsTotal > 0 ? ((row.value / dsTotal) * 100).toFixed(1) : '0.0';
          const rowY = tableTop + rowH * (rIdx + 1);
          const fillColor = rIdx % 2 === 0 ? '1E1B4B' : '15123A';

          // Row background
          slide.addShape(pptx.ShapeType.rect, {
            x: tableX, y: rowY, w: tableW, h: rowH,
            fill: { color: fillColor },
            line: { color: '2D2A6A', width: 0.5 }
          });

          // Colour swatch
          const swatchColor = row.color.replace('#', '');
          slide.addShape(pptx.ShapeType.rect, {
            x: tableX + 0.1, y: rowY + 0.13, w: 0.18, h: 0.18,
            fill: { color: swatchColor },
            line: { color: swatchColor, width: 0 },
            rectRadius: 0.04
          });

          // Label (strip emoji)
          const labelClean = row.label.replace(/[^\x20-\x7E]/g, '').trim();
          slide.addText(labelClean, {
            x: tableX + 0.35, y: rowY + 0.06, w: 2.1, h: rowH - 0.12,
            fontSize: 9, color: 'D1D5DB', fontFace: 'Calibri'
          });

          // Count
          slide.addText(String(row.value), {
            x: tableX + 2.5, y: rowY + 0.06, w: 1.7, h: rowH - 0.12,
            fontSize: 10, bold: true, color: WHITE,
            align: 'center', fontFace: 'Calibri'
          });

          // Progress bar background
          slide.addShape(pptx.ShapeType.rect, {
            x: tableX + 4.2, y: rowY + 0.17, w: 1.6, h: 0.1,
            fill: { color: '374151' },
            line: { color: '374151', width: 0 },
            rectRadius: 0.05
          });
          // Progress bar fill
          const barW = Math.max((parseFloat(pct) / 100) * 1.6, 0.05);
          slide.addShape(pptx.ShapeType.rect, {
            x: tableX + 4.2, y: rowY + 0.17, w: barW, h: 0.1,
            fill: { color: swatchColor },
            line: { color: swatchColor, width: 0 },
            rectRadius: 0.05
          });
          // Percentage label
          slide.addText(`${pct}%`, {
            x: tableX + 5.85, y: rowY + 0.06, w: 0.55, h: rowH - 0.12,
            fontSize: 9, bold: true, color: row.color.replace('#','') === swatchColor ? 'A5B4FC' : 'A5B4FC',
            align: 'right', fontFace: 'Calibri'
          });
        });

        // Key insight callout
        const topRow = [...ds.rows].sort((a, b) => b.value - a.value)[0];
        if (topRow && dsTotal > 0) {
          const topPct = ((topRow.value / dsTotal) * 100).toFixed(1);
          const insightY = tableTop + rowH * (ds.rows.length + 1) + 0.15;
          slide.addShape(pptx.ShapeType.rect, {
            x: tableX, y: insightY, w: tableW, h: 0.6,
            fill: { color: BRAND_PURPLE, transparency: 80 },
            line: { color: BRAND_PURPLE, transparency: 40, width: 1 },
            rectRadius: 0.08
          });
          const insightLabel = topRow.label.replace(/[^\x20-\x7E]/g, '').trim();
          slide.addText(`💡  Largest segment: ${insightLabel} — ${topRow.value} students (${topPct}%)`, {
            x: tableX + 0.15, y: insightY + 0.05, w: tableW - 0.3, h: 0.5,
            fontSize: 9, color: 'C7D2FE', fontFace: 'Calibri'
          });
        }

        return slide;
      });

      // ────────────────────────────────────────────────────────────────────
      // Add footers to all content slides (skip cover)
      // ────────────────────────────────────────────────────────────────────
      const allContentSlides = [chartSlide, ...categorySlides];
      const totalSlideCount = 1 + allContentSlides.length; // cover + content
      allContentSlides.forEach((slide, idx) => {
        addSlideFooter(slide, idx + 2, totalSlideCount);
      });

      // ── Save file ──
      const fileName = `Analytics_Report_${filterLabel.replace(/[\s/]/g, '_')}_${new Date().toISOString().slice(0,10)}.pptx`;
      await pptx.writeFile({ fileName });
      showToast('PowerPoint report downloaded!', 'success');
    } catch (e) {
      console.error('PPTX export error:', e);
      showToast('Failed to export PowerPoint.', 'error');
    } finally {
      setExportLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const banks = [
    'Bank of Ceylon', "People's Bank", 'Commercial Bank', 'Hatton National Bank',
    'Sampath Bank', 'Amana Bank', 'National Savings Bank', 'DFCC Bank',
    'Seylan Bank', 'Nations Trust Bank', 'Pan Asia Banking Corporation', 'Union Bank'
  ];

  // 1. Fetch Admin Settings
  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        setSettingsForm({
          adminCol1Title: data.admin_col1_title,
          adminCol2Title: data.admin_col2_title,
          adminCol3Title: data.admin_col3_title
        });
        setSheetsForm({
          googleSheetsId: data.google_sheets_id,
          googleSheetsClientEmail: data.google_sheets_client_email,
          googleSheetsPrivateKey: data.google_sheets_private_key
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Fetch Student List
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: currentPage,
        limit,
        utNo: searchParams.utNo,
        name: searchParams.name,
        phoneNo: searchParams.phoneNo,
        beneficiaryName: searchParams.beneficiaryName,
        bank: searchParams.bank,
        studentType: searchParams.studentType,
        courseName: searchParams.courseName,
        _t: Date.now()
      }).toString();

      const res = await fetch(`${API_URL}/admin/students?${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        if (data.students && Array.isArray(data.students)) {
          data.students.sort((a, b) => Number(b.blossom_trust_amount || 0) - Number(a.blossom_trust_amount || 0));
        }
        setStudents(data.students);
        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.total);
      } else {
        showToast(data.message || 'Failed to load student list.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to the server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Edit Requests
  const fetchEditRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/edit-requests?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEditRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRequestsLoading(false);
    }
  };

  // 4. Load Stats for Dashboard
  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/stats?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          total: data.total || 0,
          pendingRequests: data.pendingRequests || 0,
          dropouts: data.dropouts || 0,
          lowAlternance: data.lowAlternance || 0,
          completedCount: data.charts?.completedVsDropped?.completed || 0,
          dropoutCount: data.charts?.completedVsDropped?.dropped || 0,
          courseSplits: data.charts?.courses || {},
          employmentStatus: data.charts?.employment || {},
          studentTypeSplits: data.charts?.studentTypes || {},
          courseSpecialization: data.charts?.courseSpecialization || {},
          employmentStatusNew: data.charts?.employmentStatus || {},
          otherStatus: data.charts?.otherStatus || {}
        });
      }
    } catch (err) {
      console.error('Stats load error:', err);
    }
  };

  // 4b. Load Analytics Data for 3D Pie Chart widget (date-filterable).
  // Accepts the filter object EXPLICITLY so it never reads stale state from a
  // closure. Pass analyticsFilter as the argument.
  const loadAnalytics = useCallback(async (filter) => {
    const f = filter || analyticsFilter;
    setAnalyticsLoading(true);
    setAnalyticsData(null); // Clear out stale chart values during loading
    try {
      const params = new URLSearchParams({ _t: Date.now() });
      if (f.mode === 'yearly' && f.year)  params.set('year', f.year);
      if (f.mode === 'monthly' && f.year) {
        params.set('year', f.year);
        if (f.month) params.set('month', f.month);
      }
      const res = await fetch(`${API_URL}/admin/stats/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);   // single state update → React re-renders charts
      } else {
        console.error('Analytics API error:', res.status);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token, API_URL, analyticsFilter]);

  // ── On mount and whenever analyticsFilter changes, fetch fresh data ──
  // Passing analyticsFilter directly eliminates the ref timing race.
  useEffect(() => {
    if (token) loadAnalytics(analyticsFilter);
  }, [analyticsFilter, token, loadAnalytics]);

  // ── Mount: also load all other data ──
  useEffect(() => {
    if (token) {
      fetchSettings();
      fetchStudents();
      fetchEditRequests();
      loadStats();
      // loadAnalytics is already triggered by the analyticsFilter effect above
    }
  }, [token, currentPage]);

  // Debounced Live Search
  useEffect(() => {
    if (!token) return;
    
    // We only want to trigger search if user actually changed filters, 
    // not on initial mount (which is handled above)
    const timeoutId = setTimeout(() => {
      // Reset to page 1 on search change
      if (currentPage !== 1) {
        setCurrentPage(1); // this will trigger the main useEffect
      } else {
        fetchStudents();
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [searchParams]);

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const triggerSearch = (e) => {
    if (e) e.preventDefault();
    setCurrentPage(1);
    fetchStudents();
  };

  const resetSearch = () => {
    setSearchParams(prev => ({
      utNo: '',
      name: '',
      phoneNo: '',
      beneficiaryName: '',
      bank: '',
      studentType: prev.studentType,
      courseName: ''
    }));
    setCurrentPage(1);
  };

  // 5. Open Student Details Drawer
  const openStudentDrawer = async (studentId) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/students/${studentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedStudent(data.student);
        setAdminFieldInputs({
          adminCol1Val: data.student.admin_col1_val || '',
          adminCol2Val: data.student.admin_col2_val || '',
          adminCol3Val: data.student.admin_col3_val || 0,
          blossomTrustAmount: data.student.blossom_trust_amount || 0,
          dropout_status: String(data.student.dropout_status) === "true" || Number(data.student.dropout_status) === 1,
          dropout_reason: data.student.dropout_reason || '',
          dropout_date: data.student.dropout_date || '',
          isLowAlternance: !!data.student.low_alternance_reason,
          lowAlternanceReason: data.student.low_alternance_reason || '',
          lowAlternanceHours: data.student.low_alternance_hours || '',
          courseName: data.student.course_name || '',
          batch: data.student.batch || '',
          courseSpecialization: data.student.course_specialization || '',
          employmentStatus: data.student.employment_status || '',
          otherStatus: data.student.other_status || '',
          courseCompletionStatus: data.student.course_completion_status || '',
          email: data.student.email || ''
        });
      } else {
        showToast(data.message || 'Error loading details.', 'error');
        setDrawerOpen(false);
      }
    } catch (err) {
      showToast('Error loading details.', 'error');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  // 6. Save Admin Editable Fields (includes Blossom Trust Amount)
  const saveAdminFields = async (e) => {
    e.preventDefault();
    setSaveLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/students/${selectedStudent.id}/admin-fields`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adminCol1Val: adminFieldInputs.adminCol1Val,
          adminCol2Val: adminFieldInputs.adminCol2Val,
          adminCol3Val: adminFieldInputs.adminCol3Val,
          blossomTrustAmount: adminFieldInputs.blossomTrustAmount,
          dropout_status: adminFieldInputs.dropout_status,
          dropout_reason: adminFieldInputs.dropout_status ? adminFieldInputs.dropout_reason : null,
          dropout_date: adminFieldInputs.dropout_status ? adminFieldInputs.dropout_date : null,
          isLowAlternance: adminFieldInputs.isLowAlternance,
          lowAlternanceReason: adminFieldInputs.isLowAlternance ? adminFieldInputs.lowAlternanceReason : null,
          lowAlternanceHours: adminFieldInputs.isLowAlternance ? adminFieldInputs.lowAlternanceHours : null,
          courseName: adminFieldInputs.courseName,
          batch: adminFieldInputs.batch,
          courseSpecialization: adminFieldInputs.courseSpecialization,
          employmentStatus: adminFieldInputs.employmentStatus,
          otherStatus: adminFieldInputs.otherStatus,
          courseCompletionStatus: adminFieldInputs.courseCompletionStatus,
          email: adminFieldInputs.email
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setSelectedStudent(data.student);
        await fetchStudents();
        setStudents(prev => {
          const updated = prev.map(s => s.id === data.student.id ? data.student : s);
          return updated.sort((a, b) => Number(b.blossom_trust_amount || 0) - Number(a.blossom_trust_amount || 0));
        });
        loadStats();
        // Re-fetch analytics with the current live filter — direct call, no trigger state
        loadAnalytics(analyticsFilter);
      } else {
        showToast(data.message || 'Failed to save details.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // 7. Approve / Reject Request
  const handleRequestStatus = async (requestId, action) => {
    try {
      const res = await fetch(`${API_URL}/admin/edit-requests/${requestId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        fetchEditRequests();
        fetchStudents();
        loadStats();
        // Re-fetch analytics with the current live filter — direct call, no trigger state
        loadAnalytics(analyticsFilter);
        if (selectedStudent) {
          openStudentDrawer(selectedStudent.id);
        }
      } else {
        showToast(data.message || 'Request failed.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    }
  };

  // 8. Custom Headers Modifying
  const saveCustomHeaders = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adminCol1Title: settingsForm.adminCol1Title,
          adminCol2Title: settingsForm.adminCol2Title,
          adminCol3Title: settingsForm.adminCol3Title
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        fetchSettings();
        setShowSettingsModal(false);
      } else {
        showToast(data.message || 'Error updating titles.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  // 9. Excel Upload
  const handleExcelUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('excel', excelFile);

    try {
      const res = await fetch(`${API_URL}/admin/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setExcelFile(null);
        fetchStudents();
        loadStats();
        // Re-fetch analytics with the current live filter — direct call, no trigger state
        loadAnalytics(analyticsFilter);
      } else {
        showToast(data.message || 'Import failed.', 'error');
      }
    } catch (err) {
      showToast('Error uploading spreadsheet.', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  // 9.5 Attendance Upload
  const handleAttendanceUpload = async (e) => {
    e.preventDefault();
    if (!attendanceFile) return;

    setAttendanceUploadLoading(true);
    const formData = new FormData();
    formData.append('attendanceFile', attendanceFile);
    formData.append('month', attendanceMonth);
    formData.append('year', attendanceYear);
    formData.append('threshold', attendanceThreshold);

    try {
      const res = await fetch(`${API_URL}/admin/attendance/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setAttendanceFile(null);
        await fetchStudents();
        loadStats();
        // Re-fetch analytics with the current live filter — direct call, no trigger state
        loadAnalytics(analyticsFilter);
      } else {
        showToast(data.message || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast('Error uploading attendance.', 'error');
    } finally {
      setAttendanceUploadLoading(false);
    }
  };

  // 10. Google Sheets Credentials save and Sync
  const saveGoogleSheetsSettings = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          googleSheetsId: sheetsForm.googleSheetsId,
          googleSheetsClientEmail: sheetsForm.googleSheetsClientEmail,
          googleSheetsPrivateKey: sheetsForm.googleSheetsPrivateKey
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Google Sheets settings saved successfully!');
        fetchSettings();
      } else {
        showToast(data.message || 'Failed to save settings.', 'error');
      }
    } catch (err) {
      showToast('Error saving settings.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const triggerGoogleSheetsSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/sync-sheets`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, data.simulated ? 'warning' : 'success');
      } else {
        showToast(data.message || 'Google Sheets sync failed.', 'error');
      }
    } catch (err) {
      showToast('Error triggering sync.', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  // 11. Secure Reports Downloader
  const downloadReport = async (reportEndpoint, filename) => {
    try {
      showToast('Preparing your report download...', 'warning');
      const res = await fetch(`${API_URL}/admin/reports/${reportEndpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Generation failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Report downloaded successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to download report.', 'error');
    }
  };

  // Download Sample Excel Template
  const downloadSampleTemplate = async () => {
    try {
      showToast('Downloading sample template...', 'warning');
      const res = await fetch(`${API_URL}/admin/import/sample`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Download failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Student_Bulk_Upload_Sample.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Sample template downloaded.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to download sample.', 'error');
    }
  };




  // Safe paginated rendering numbers
  const renderPagination = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      pages.push(
        <button
          key={p}
          onClick={() => setCurrentPage(p)}
          className="btn btn-secondary"
          style={{
            padding: '6px 12px',
            fontSize: '0.85rem',
            background: p === currentPage ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.04)',
            color: p === currentPage ? '#fff' : 'hsl(var(--text-secondary))',
            borderColor: p === currentPage ? 'hsl(var(--primary))' : 'hsla(var(--border-glass))'
          }}
        >
          {p}
        </button>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          className="btn btn-secondary"
          style={{ padding: '6px 10px' }}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={16} />
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          className="btn btn-secondary"
          style={{ padding: '6px 10px' }}
          disabled={currentPage === totalPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Sidebar Navigation */}
      <div className="glass-panel" style={{
        width: '260px',
        borderRadius: '0',
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        zIndex: 5
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet color="hsl(var(--primary))" size={24} /> Blossom Trust
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '6px' }}>
            Reporting Portal
          </p>
        </div>

        {/* Tab Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: activeTab === 'overview' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'overview' ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))',
              border: 'none',
              width: '100%'
            }}
            onClick={() => setActiveTab('overview')}
          >
            <Server size={18} /> Overview
          </button>
          
          <button 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: activeTab === 'students' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'students' ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))',
              border: 'none',
              width: '100%'
            }}
            onClick={() => { setActiveTab('students'); fetchStudents(); }}
          >
            <Users size={18} /> Student List
          </button>
          
          <button 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: activeTab === 'requests' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'requests' ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))',
              border: 'none',
              width: '100%',
              position: 'relative'
            }}
            onClick={() => { setActiveTab('requests'); fetchEditRequests(); }}
          >
            <ShieldAlert size={18} /> Edit Requests
            {stats.pendingRequests > 0 && (
              <span style={{ position: 'absolute', right: '12px', background: 'hsl(var(--warning))', color: '#1e1b4b', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '8px' }}>
                {stats.pendingRequests}
              </span>
            )}
          </button>
          
          <button 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: activeTab === 'reports' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'reports' ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))',
              border: 'none',
              width: '100%'
            }}
            onClick={() => setActiveTab('reports')}
          >
            <FileText size={18} /> Report Center
          </button>
          
          <button 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: activeTab === 'integration' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'integration' ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))',
              border: 'none',
              width: '100%'
            }}
            onClick={() => setActiveTab('integration')}
          >
            <RefreshCw size={18} /> Data Settings
          </button>
        </div>

        <button className="btn btn-secondary" onClick={logout} style={{ width: '100%' }}>
          Logout
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', height: '100vh' }}>
        
        {/* TOP TITLE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem' }}>Admin Dashboard</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', marginTop: '4px' }}>
              Manage Blossom Trust student profiles, generate sheets reports, and configure integration.
            </p>
          </div>
          
          {activeTab === 'students' && (
            <button className="btn btn-primary" onClick={() => setShowSettingsModal(true)}>
              <Sliders size={16} /> Edit Column Titles
            </button>
          )}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Stats Cards */}
            <div className="grid-4">
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'hsl(var(--primary-hover))' }}>
                  <Users size={32} />
                </div>
                <div>
                  <h4 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '4px' }}>Total Records</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.total.toLocaleString()}</p>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: 'hsl(var(--warning))' }}>
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h4 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '4px' }}>Pending Requests</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.pendingRequests}</p>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: 'hsl(var(--danger))' }}>
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h4 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '4px' }}>Dropouts</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.dropouts}</p>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '12px', color: '#f97316' }}>
                  <HelpCircle size={32} />
                </div>
                <div>
                  <h4 style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '4px' }}>Low Alternance</h4>
                  <p style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.lowAlternance}</p>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════
                3D PIE CHART — Student Repository Analytics
                ═══════════════════════════════════════════ */}
            <div>
              {/* Section Header + Date Filter Controls */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📊</span> Student Repository Analytics
                  </h3>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.78rem', marginTop: '4px' }}>
                    {analyticsFilter.mode === 'all' && 'Showing all-time data'}
                    {analyticsFilter.mode === 'yearly' && `Showing data for year ${analyticsFilter.year}`}
                    {analyticsFilter.mode === 'monthly' && analyticsFilter.month && `Showing data for ${['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(analyticsFilter.month)-1]} ${analyticsFilter.year}`}
                    {analyticsData && <span style={{ color: 'hsl(var(--primary-hover))', marginLeft: '8px' }}>· {analyticsData.total} students</span>}
                  </p>
                </div>

                {/* Filter Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Mode Buttons */}
                  {['all', 'yearly', 'monthly'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setAnalyticsFilter(prev => ({ ...prev, mode }))}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        background: analyticsFilter.mode === mode
                          ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))'
                          : 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        boxShadow: analyticsFilter.mode === mode ? '0 3px 10px rgba(99,102,241,0.4)' : 'none',
                        transition: 'all 0.22s ease',
                        letterSpacing: '0.02em',
                        textTransform: 'capitalize'
                      }}
                    >
                      {mode === 'all' ? 'All Time' : mode === 'yearly' ? 'Yearly' : 'Monthly'}
                    </button>
                  ))}

                  {/* Year Picker (shown for yearly / monthly) */}
                  {(analyticsFilter.mode === 'yearly' || analyticsFilter.mode === 'monthly') && (
                    <select
                      value={analyticsFilter.year}
                      onChange={e => setAnalyticsFilter(prev => ({ ...prev, year: e.target.value }))}
                      style={{
                        padding: '6px 10px', borderRadius: '8px',
                        background: 'rgba(15,12,45,0.9)',
                        border: '1px solid rgba(99,102,241,0.35)',
                        color: '#fff', fontSize: '0.82rem', cursor: 'pointer'
                      }}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  )}

                  {/* Month Picker (shown for monthly only) */}
                  {analyticsFilter.mode === 'monthly' && (
                    <select
                      value={analyticsFilter.month}
                      onChange={e => setAnalyticsFilter(prev => ({ ...prev, month: e.target.value }))}
                      style={{
                        padding: '6px 10px', borderRadius: '8px',
                        background: 'rgba(15,12,45,0.9)',
                        border: '1px solid rgba(99,102,241,0.35)',
                        color: '#fff', fontSize: '0.82rem', cursor: 'pointer'
                      }}
                    >
                      <option value="">All Months</option>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  )}

                  {/* Refresh button */}
                  <button
                    onClick={() => loadAnalytics(analyticsFilter)}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.35)',
                      background: 'rgba(99,102,241,0.1)', color: 'hsl(var(--primary-hover))',
                      cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'all 0.2s'
                    }}
                    disabled={analyticsLoading}
                    title="Refresh chart data"
                  >
                    {analyticsLoading ? '⏳' : '↻'} Refresh
                  </button>

                  {/* ── Export Dropdown ── */}
                  <div style={{ position: 'relative' }}>
                    <button
                      id="analytics-export-btn"
                      onClick={() => setShowExportMenu(v => !v)}
                      disabled={exportLoading || analyticsLoading}
                      style={{
                        padding: '6px 14px', borderRadius: '8px',
                        border: '1px solid rgba(16,185,129,0.45)',
                        background: exportLoading ? 'rgba(16,185,129,0.05)' : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,182,212,0.12))',
                        color: exportLoading ? 'rgba(255,255,255,0.4)' : '#10b981',
                        cursor: exportLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem', fontWeight: '700',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(16,185,129,0.15)'
                      }}
                      title="Export analytics"
                    >
                      {exportLoading ? (
                        <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Exporting…</>
                      ) : (
                        <><Download size={14} /> Export ▾</>
                      )}
                    </button>

                    {/* Dropdown panel */}
                    {showExportMenu && !exportLoading && (
                      <div
                        style={{
                          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                          background: 'linear-gradient(135deg, rgba(15,12,50,0.98), rgba(10,8,40,0.99))',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: '12px',
                          padding: '8px',
                          zIndex: 50,
                          minWidth: '180px',
                          boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)',
                          backdropFilter: 'blur(20px)'
                        }}
                      >
                        {/* Close on outside click */}
                        <div
                          style={{ position: 'fixed', inset: 0, zIndex: -1 }}
                          onClick={() => setShowExportMenu(false)}
                        />

                        {[
                          { icon: '🖼️', label: 'Image (PNG)', desc: 'Chart snapshot', action: exportAsImage },
                          { icon: '📄', label: 'PDF Report', desc: 'Chart + stats table', action: exportAsPDF },
                          { icon: '📝', label: 'Word (DOCX)', desc: 'Chart + data table', action: exportAsWord },
                          { icon: '📊', label: 'PowerPoint (PPTX)', desc: 'Multi-slide presentation', action: exportAsPPTX },
                        ].map(opt => (
                          <button
                            key={opt.label}
                            onClick={opt.action}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '9px 12px', borderRadius: '8px', border: 'none',
                              background: 'transparent', color: '#fff', cursor: 'pointer',
                              textAlign: 'left', transition: 'background 0.15s',
                              marginBottom: '2px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{opt.icon}</span>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '700' }}>{opt.label}</div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>{opt.desc}</div>
                            </div>
                          </button>
                        ))}

                        <div style={{ margin: '6px 0 4px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                        <div style={{ padding: '4px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
                          Exports current filtered view
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Loading overlay */}
              {analyticsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div className="loader-spinner" style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '0.82rem', color: 'hsl(var(--primary-hover))' }}>Updating charts…</span>
                </div>
              )}

              {/* 3D Pie Chart Grid — all 6 categories always rendered */}
              <div
                ref={analyticsChartRef}
                id="analytics-chart-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '20px',
                  background: '#0f0c2d',
                  padding: '16px',
                  borderRadius: '14px'
                }}
              >
                {/* ── Safety-destructure each dataset at the top of the render block ── */}
                {(() => {
                  const chartKey   = analyticsData?.fetchedAt || 'initial';
                  const dropout    = analyticsData?.dropoutStatus;
                  const completion = analyticsData?.courseCompletionStatus;
                  const employment = analyticsData?.employmentStatus;
                  const other      = analyticsData?.otherStatus;
                  const types      = analyticsData?.studentTypes;
                  const specializ  = analyticsData?.courseSpecialization;

                  return (
                    <>
                      {/* Chart 1: Dropout Status */}
                      <ThreeDPieChart
                        key={`${chartKey}-dropout`}
                        title="Dropout Status"
                        subtitle="Active vs Dropped Out"
                        data={[
                          { label: '✅ Active Students', value: dropout?.active   ?? 0, color: '#22c55e' },
                          { label: '🚫 Dropped Out',     value: dropout?.dropped  ?? 0, color: '#ef4444' }
                        ]}
                      />

                      {/* Chart 2: Course Completion */}
                      <ThreeDPieChart
                        key={`${chartKey}-completion`}
                        title="Course Completion"
                        subtitle="Completion status breakdown"
                        data={[
                          { label: '🎓 Completed',   value: completion?.completed  ?? stats.completedCount ?? 0,  color: '#6366f1' },
                          { label: '📘 In Progress', value: completion?.inProgress ?? 0, color: '#f59e0b' },
                          { label: '⏳ Not Started', value: completion?.notStarted ?? ((stats.total - (stats.completedCount ?? 0) - (stats.dropouts ?? 0)) >= 0 ? (stats.total - (stats.completedCount ?? 0) - (stats.dropouts ?? 0)) : 0), color: '#94a3b8' }
                        ]}
                      />

                      {/* Chart 3: Employment Status */}
                      <ThreeDPieChart
                        key={`${chartKey}-employment`}
                        title="Employment Status"
                        subtitle="Industry placement distribution"
                        data={[
                          { label: '💻 Software Industry', value: employment?.software ?? stats.employmentStatusNew?.software ?? 0, color: '#06b6d4' },
                          { label: '🏢 Other Industry',    value: employment?.other    ?? stats.employmentStatusNew?.other    ?? 0, color: '#8b5cf6' }
                        ]}
                      />

                      {/* Chart 4: Other Status */}
                      <ThreeDPieChart
                        key={`${chartKey}-other`}
                        title="Other Status"
                        subtitle="Further study & placement"
                        data={[
                          { label: '📚 Higher Study',  value: other?.higherStudy  ?? stats.otherStatus?.higherStudy  ?? 0, color: '#3b82f6' },
                          { label: '🔍 Unemployment',  value: other?.unemployment ?? stats.otherStatus?.unemployment ?? 0, color: '#f97316' },
                          { label: '✈️ Foreign',        value: other?.foreign      ?? stats.otherStatus?.foreign      ?? 0, color: '#10b981' }
                        ]}
                      />

                      {/* Chart 5: Student Type */}
                      <ThreeDPieChart
                        key={`${chartKey}-types`}
                        title="Student Type Split"
                        subtitle="Blossom vs Non-Blossom"
                        data={[
                          { label: '🌸 Blossom Trust', value: types?.blossom    ?? stats.studentTypeSplits?.blossom    ?? 0, color: '#ec4899' },
                          { label: '🎓 Non-Blossom',   value: types?.nonBlossom ?? stats.studentTypeSplits?.nonBlossom ?? 0, color: '#06b6d4' }
                        ]}
                      />

                      {/* Chart 6: Course Specialization */}
                      <ThreeDPieChart
                        key={`${chartKey}-specializ`}
                        title="Course Specialization"
                        subtitle="Full Stack vs Front End"
                        data={[
                          { label: '⚙️ Full Stack Dev', value: specializ?.fullStack ?? stats.courseSpecialization?.fullStack ?? 0, color: '#a78bfa' },
                          { label: '🖥️ Front End Dev',  value: specializ?.frontEnd  ?? stats.courseSpecialization?.frontEnd  ?? 0, color: '#34d399' }
                        ]}
                      />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid-2" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
              
              <div className="glass-panel" style={{ padding: '28px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Excel Student Bulk Importer</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  Upload an Excel workbook (<code>.xlsx</code>) to bulk import student records. New students will receive credentials automatically, and existing students will have their profile information updated.
                  <button className="btn btn-secondary" onClick={downloadSampleTemplate} style={{ marginTop: '12px' }}>Download Sample</button>
                </p>

                <form onSubmit={handleExcelUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ border: '2px dashed hsla(var(--border-glass))', borderRadius: '10px', padding: '32px', textAlign: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', transition: 'var(--transition-smooth)' }} onClick={() => document.getElementById('excel-file-uploader').click()}>
                    <Upload size={32} style={{ color: 'hsl(var(--primary-hover))', marginBottom: '12px' }} />
                    <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                      {excelFile ? excelFile.name : 'Choose Excel Workbook'}
                    </div>
                    <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.78rem', marginTop: '6px' }}>
                      Supports .xlsx file sheets up to 10MB
                    </div>
                    <input 
                      type="file" 
                      id="excel-file-uploader" 
                      accept=".xlsx" 
                      style={{ display: 'none' }} 
                      onChange={(e) => setExcelFile(e.target.files[0])}
                    />
                  </div>
                  
                  {excelFile && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setExcelFile(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={uploadLoading}>
                        {uploadLoading ? 'Uploading...' : 'Execute Import'}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Google Sheets Sync</h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '16px' }}>
                    Publish and sync the centralized student repository directly to your organization's Google Sheet.
                  </p>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid hsla(var(--border-glass))', borderRadius: '8px', padding: '12px', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Target ID:</span>
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>{settings.google_sheets_id ? `${settings.google_sheets_id.substring(0, 8)}...` : 'Not Configured'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Connection:</span>
                      <span>{settings.google_sheets_client_email ? <span style={{ color: 'hsl(var(--success))' }}>Configured</span> : <span style={{ color: 'hsl(var(--warning))' }}>Simulation Fallback</span>}</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', gap: '8px', marginTop: '24px' }}
                  onClick={triggerGoogleSheetsSync}
                  disabled={syncLoading}
                >
                  <RefreshCw size={16} className={syncLoading ? 'spin' : ''} />
                  {syncLoading ? 'Syncing...' : 'Sync to Google Sheets Now'}
                </button>
              </div>

            </div>

            {/* Second Row Quick Actions */}
            <div className="grid-2" style={{ gridTemplateColumns: '1.5fr 1fr', marginTop: '32px' }}>
              
              <div className="glass-panel" style={{ padding: '28px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Monthly Attendance Upload</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  Upload a monthly attendance file (Excel, CSV, or structured PDF). The system will automatically parse the file, update student records, and flag students below the attendance threshold you set here.
                </p>

                <form onSubmit={handleAttendanceUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label">Month</label>
                      <select className="form-select" value={attendanceMonth} onChange={(e) => setAttendanceMonth(e.target.value)}>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label">Year</label>
                      <input type="number" className="form-input" value={attendanceYear} onChange={(e) => setAttendanceYear(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label">Threshold (%)</label>
                      <input type="number" className="form-input" placeholder="e.g. 80" value={attendanceThreshold} onChange={(e) => setAttendanceThreshold(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ border: '2px dashed hsla(var(--border-glass))', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', transition: 'var(--transition-smooth)' }} onClick={() => document.getElementById('attendance-file-uploader').click()}>
                    <Upload size={24} style={{ color: 'hsl(var(--primary-hover))', marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                      {attendanceFile ? attendanceFile.name : 'Choose Attendance File (.xlsx, .csv, .pdf)'}
                    </div>
                    <input 
                      type="file" 
                      id="attendance-file-uploader" 
                      accept=".xlsx,.xls,.csv,.pdf" 
                      style={{ display: 'none' }} 
                      onChange={(e) => setAttendanceFile(e.target.files[0])}
                    />
                  </div>
                  
                  {attendanceFile && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setAttendanceFile(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={attendanceUploadLoading}>
                        {attendanceUploadLoading ? 'Uploading...' : 'Process Attendance'}
                      </button>
                    </div>
                  )}

                  {!attendanceFile && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ border: '1px solid hsl(var(--danger))', color: 'hsl(var(--danger))', background: 'transparent' }}
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to completely clear the attendance data for ${attendanceMonth} ${attendanceYear}? This will delete the records for this month and reset student statuses.`)) {
                            try {
                              setAttendanceUploadLoading(true);
                              const res = await fetch(`${API_URL}/admin/attendance/clear`, {
                                method: 'POST',
                                headers: { 
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ month: attendanceMonth, year: attendanceYear })
                              });
                              const data = await res.json();
                              // Always refresh student list and stats regardless of response
                              // This ensures stale low_attendance_status is cleared from UI
                              // even when the server says records were already cleared
                              await fetchStudents();
                              loadStats();
                              if (res.ok) {
                                showToast(data.message || `Attendance cleared for ${attendanceMonth} ${attendanceYear}.`, 'success');
                              } else if (res.status === 404) {
                                showToast('Attendance data was already cleared. Student list has been refreshed.', 'success');
                              } else {
                                showToast(data.message || 'Error clearing attendance.', 'error');
                              }
                            } catch (err) {
                              showToast('Error connecting to the server.', 'error');
                            } finally {
                              setAttendanceUploadLoading(false);
                            }
                          }
                        }}
                        disabled={attendanceUploadLoading}
                      >
                        {attendanceUploadLoading ? 'Processing...' : `Clear ${attendanceMonth} ${attendanceYear}`}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Attendance Status Info</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '16px' }}>
                  Students flagged with low attendance will automatically be highlighted in <strong style={{ color: 'hsl(var(--warning))' }}>yellow</strong> on the Student List. 
                  Dropout students will be highlighted in <strong style={{ color: 'hsl(var(--danger))' }}>red</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid hsl(var(--danger))' }}></div>
                    <span>Dropout (Overrides low attendance)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.3)', border: '1px solid hsl(var(--warning))' }}></div>
                    <span>Low Attendance Flagged</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: STUDENTS GRID */}
        {activeTab === 'students' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Student Type Sub-Tabs */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '12px', marginBottom: '8px' }}>
              <button 
                type="button"
                onClick={() => setSearchParams(prev => ({ ...prev, studentType: 'blossom', beneficiaryName: '', bank: '', page: 1 }))}
                style={{
                  padding: '10px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  background: searchParams.studentType === 'blossom' ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' : 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  transition: 'var(--transition-smooth)',
                  boxShadow: searchParams.studentType === 'blossom' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                }}
              >
                🌸 Blossom Trust Students
              </button>
              <button 
                type="button"
                onClick={() => setSearchParams(prev => ({ ...prev, studentType: 'non_blossom', courseName: '', page: 1 }))}
                style={{
                  padding: '10px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  background: searchParams.studentType === 'non_blossom' ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' : 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  transition: 'var(--transition-smooth)',
                  boxShadow: searchParams.studentType === 'non_blossom' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                }}
              >
                🎓 Non-Blossom Students
              </button>
            </div>

            {/* Search/Filters Panel */}
            <form onSubmit={triggerSearch} className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Search UT No</label>
                  <input
                    type="text"
                    name="utNo"
                    className="form-input"
                    placeholder="e.g. UT-2025"
                    value={searchParams.utNo}
                    onChange={handleSearchChange}
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Search Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    placeholder="e.g. Priyantha"
                    value={searchParams.name}
                    onChange={handleSearchChange}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Search Phone</label>
                  <input
                    type="text"
                    name="phoneNo"
                    className="form-input"
                    placeholder="e.g. 077"
                    value={searchParams.phoneNo}
                    onChange={handleSearchChange}
                  />
                </div>

                {searchParams.studentType === 'blossom' ? (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Beneficiary Name</label>
                      <input
                        type="text"
                        name="beneficiaryName"
                        className="form-input"
                        placeholder="Search beneficiary"
                        value={searchParams.beneficiaryName}
                        onChange={handleSearchChange}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Bank Filter</label>
                      <select
                        name="bank"
                        className="form-select"
                        value={searchParams.bank}
                        onChange={handleSearchChange}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">All Banks</option>
                        {banks.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Course Filter</label>
                      <select
                        name="courseName"
                        className="form-select"
                        value={searchParams.courseName}
                        onChange={handleSearchChange}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">All Courses</option>
                        <option value="Full Stack Developer">Full Stack Developer</option>
                        <option value="Front End Developer">Front End Developer</option>
                      </select>
                    </div>
                    {/* Empty placeholder to keep the grid alignment clean */}
                    <div style={{ marginBottom: 0 }}></div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                  Found <span style={{ color: '#fff', fontWeight: 'bold' }}>{totalRecords}</span> student records.
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={resetSearch}>Reset</button>
                  <button type="submit" className="btn btn-primary"><Search size={16} /> Search</button>
                </div>
              </div>
            </form>

            {/* Students Table */}
            <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                  <div className="loader-spinner"></div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    {searchParams.studentType === 'blossom' ? (
                      <>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>UT No</th>
                            <th>Name</th>
                            <th>Phone No</th>
                            <th>District</th>
                            <th>Beneficiary Name</th>
                            <th>Blossom Trust Amt</th>
                            <th>Bank</th>
                            <th>Branch Name</th>
                            <th>Br. Code</th>
                            <th>Account No</th>
                            <th>Course Spec.</th>
                            <th>{settings.admin_col1_title}</th>
                            <th>{settings.admin_col2_title}</th>
                            <th>{settings.admin_col3_title}</th>
                            <th>Emp. Status</th>
                            <th>Other Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s, index) => {
                            const isDropout = Boolean(
                              s.dropout_status === true ||
                              s.dropout_status === "true" ||
                              s.dropout_status === 1 ||
                              s.dropout_status === "1"
                            );
                            const isLowAttendance = s.low_attendance_status === true || s.low_attendance_status === 1 || String(s.low_attendance_status) === "true";

                            return (
                              <tr 
                                key={s.id} 
                                onClick={() => openStudentDrawer(s.id)}
                                className={isDropout ? 'row-danger' : isLowAttendance ? 'row-warning' : ''}
                                style={{ cursor: 'pointer' }}
                              >
                                <td style={{ fontWeight: '600' }}>
                                  {(currentPage - 1) * limit + index + 1}
                                </td>
                                <td style={{ fontWeight: '600' }}>
                                  {s.ut_no || '-'}
                                  {isDropout && (
                                    <span className="badge badge-danger" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>DROPOUT</span>
                                  )}
                                  {!isDropout && isLowAttendance && (
                                    <span className="badge badge-warning" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>LOW ATTENDANCE</span>
                                  )}
                                </td>
                                <td>{s.full_name || '-'}</td>
                                <td>{s.phone_number || '-'}</td>
                                <td>{s.district || '-'}</td>
                                <td>{s.beneficiary_name || '-'}</td>
                                <td style={{ fontWeight: '500', color: 'hsl(var(--primary-hover))' }}>
                                  {s.blossom_trust_amount ? `LKR ${Number(s.blossom_trust_amount).toLocaleString()}` : 'LKR 0'}
                                </td>
                                <td>{s.bank_name || '-'}</td>
                                <td>{s.branch_name || s.branch || '-'}</td>
                                <td>{s.branch_code || '-'}</td>
                                <td>{s.account_no || '-'}</td>
                                <td>{s.course_specialization || '-'}</td>
                                <td>
                                  <span className="badge badge-draft" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                                    {s.admin_col1_val || 'N/A'}
                                  </span>
                                </td>
                                <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.admin_col2_val || 'N/A'}</td>
                                <td style={{ fontWeight: '500', color: 'hsl(var(--success))' }}>
                                  {s.admin_col3_val ? `LKR ${s.admin_col3_val.toLocaleString()}` : 'LKR 0'}
                                </td>
                                <td>{s.employment_status || '-'}</td>
                                <td>{s.other_status || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </>
                    ) : (
                      <>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>UT No</th>
                            <th>Name</th>
                            <th>Phone No</th>
                            <th>District</th>
                            <th>Course Spec.</th>
                            <th>{settings.admin_col1_title}</th>
                            <th>{settings.admin_col2_title}</th>
                            <th>{settings.admin_col3_title}</th>
                            <th>Emp. Status</th>
                            <th>Other Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s, index) => {
                            const isDropout = Boolean(
                              s.dropout_status === true ||
                              s.dropout_status === "true" ||
                              s.dropout_status === 1 ||
                              s.dropout_status === "1"
                            );

                            return (
                              <tr 
                                key={s.id} 
                                onClick={() => openStudentDrawer(s.id)}
                                className={isDropout ? 'row-danger' : ''}
                                style={{ cursor: 'pointer' }}
                              >
                                <td style={{ fontWeight: '600' }}>
                                  {(currentPage - 1) * limit + index + 1}
                                </td>
                                <td style={{ fontWeight: '600' }}>
                                  {s.ut_no || '-'}
                                  {isDropout && (
                                    <span className="badge badge-danger" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>DROPOUT</span>
                                  )}
                                </td>
                                <td>{s.full_name || '-'}</td>
                                <td>{s.phone_number || '-'}</td>
                                <td>{s.district || '-'}</td>
                                <td>{s.course_specialization || '-'}</td>
                                <td>
                                  <span className="badge badge-draft" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                                    {s.admin_col1_val || 'N/A'}
                                  </span>
                                </td>
                                <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.admin_col2_val || 'N/A'}</td>
                                <td style={{ fontWeight: '500', color: 'hsl(var(--success))' }}>
                                  {s.admin_col3_val ? `LKR ${s.admin_col3_val.toLocaleString()}` : 'LKR 0'}
                                </td>
                                <td>{s.employment_status || '-'}</td>
                                <td>{s.other_status || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Panel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                Showing page <span style={{ color: '#fff', fontWeight: 'bold' }}>{currentPage}</span> of {totalPages} pages.
              </div>
              {renderPagination()}
            </div>

          </div>
        )}

        {/* TAB 3: EDIT REQUESTS */}
        {activeTab === 'requests' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Student Profile Access Requests</h2>
            
            {requestsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                <div className="loader-spinner"></div>
              </div>
            ) : editRequests.length === 0 ? (
              <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '40px 0' }}>No profile edit requests found.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>UT No</th>
                      <th>Reason for Edit</th>
                      <th>Date Requested</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editRequests.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: '600' }}>{r.full_name}</td>
                        <td>{r.ut_no}</td>
                        <td style={{ whiteSpace: 'normal', maxWidth: '300px', lineHeight: '1.4' }}>{r.request_reason}</td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge badge-${r.status}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                onClick={() => handleRequestStatus(r.id, 'approve')}
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--danger))', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                onClick={() => handleRequestStatus(r.id, 'reject')}
                              >
                                <X size={12} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REPORTS PORTAL */}
        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="grid-2">
              
              {/* Blossom Trust Overall Final Report Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '200px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText color="hsl(var(--primary))" size={20} /> 🌸 Blossom Trust Overall Final Report
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', lineHeight: '1.4' }}>
                    Final report for all Blossom Trust students. Includes Course Completion, Specialization, Employment Status, Salary, and Dropout Status based on latest admin-updated data.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => downloadReport('blossom-final?format=excel', 'Blossom_Trust_Final_Report.xlsx')}>
                    <Download size={14} /> Excel (.xlsx)
                  </button>
                  <button className="btn btn-secondary" onClick={() => downloadReport('blossom-final?format=pdf', 'Blossom_Trust_Final_Report.pdf')}>
                    <Download size={14} /> PDF Format
                  </button>
                </div>
              </div>


              {/* Overall Student Report Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '200px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText color="hsl(var(--primary))" size={20} /> Overall Student Report
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', lineHeight: '1.4' }}>
                    Generate unified student status reports containing both Blossom Trust and Non-Blossom Trust students.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => downloadReport('overall?format=excel', 'Overall_Student_Report.xlsx')}>
                    <Download size={14} /> Excel (.xlsx)
                  </button>
                  <button className="btn btn-secondary" onClick={() => downloadReport('overall?format=pdf', 'Overall_Student_Report.pdf')}>
                    <Download size={14} /> PDF Format
                  </button>
                </div>
              </div>

              {/* Dropout Report Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'auto', paddingBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--danger))' }}>
                    <AlertTriangle size={20} /> Dropout Students Report
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', lineHeight: '1.4', marginBottom: '16px' }}>
                    Export a monthly list of dropout students. Generates a list mapping reasons for dropouts and dates.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <MonthDropdown 
                      value={dropoutMonth} 
                      onChange={(e) => setDropoutMonth(e.target.value)} 
                    />
                    {/* Cache break test */}
                    <span style={{ display: 'none' }}>Render Test</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => downloadReport(`dropout?format=excel&month=${dropoutMonth}`, 'Dropout_Students_Report.xlsx')}>
                    <Download size={14} /> Excel (.xlsx)
                  </button>
                  <button className="btn btn-secondary" onClick={() => downloadReport(`dropout?format=pdf&month=${dropoutMonth}`, 'Dropout_Students_Report.pdf')}>
                    <Download size={14} /> PDF Format
                  </button>
                </div>
              </div>

              {/* Low Attendance Report Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'auto', paddingBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316' }}>
                    <HelpCircle size={20} /> Low Attendance Report
                  </h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', lineHeight: '1.4', marginBottom: '16px' }}>
                    Generates the Monthly Low Attendance report for a specific month using a defined attendance threshold.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <MonthDropdown 
                      value={reportMonth} 
                      onChange={(e) => setReportMonth(e.target.value)} 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => downloadReport(`low-attendance?format=excel&month=${reportMonth}`, 'Low_Attendance_Report.xlsx')}>
                    <Download size={14} /> Excel (.xlsx)
                  </button>
                  <button className="btn btn-secondary" onClick={() => downloadReport(`low-attendance?format=pdf&month=${reportMonth}`, 'Low_Attendance_Report.pdf')}>
                    <Download size={14} /> PDF Format
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: INTEGRATION SETTINGS */}
        {activeTab === 'integration' && (
          <div className="glass-panel" style={{ padding: '32px', maxWidth: '650px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={20} color="hsl(var(--primary))" /> Google Sheets Integration Settings
            </h2>
            
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Provide your Google Sheets ID and Service Account Credentials below. The backend connects directly to Google APIs using JWT configuration. Leaving fields empty runs sheets actions in simulated mock mode.
            </p>

            <form onSubmit={saveGoogleSheetsSettings}>
              <div className="form-group">
                <label className="form-label">Google Sheet ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                  value={sheetsForm.googleSheetsId}
                  onChange={(e) => setSheetsForm(prev => ({ ...prev, googleSheetsId: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Service Account Client Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. project-service@gcp-account.iam.gserviceaccount.com"
                  value={sheetsForm.googleSheetsClientEmail}
                  onChange={(e) => setSheetsForm(prev => ({ ...prev, googleSheetsClientEmail: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">Service Account Private Key (PEM format)</label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                  value={sheetsForm.googleSheetsPrivateKey}
                  onChange={(e) => setSheetsForm(prev => ({ ...prev, googleSheetsPrivateKey: e.target.value }))}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={settingsLoading}>
                  <Save size={16} /> Save Credentials
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Slide-out Student Details Drawer */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}></div>
          <div className="drawer">
            <div className="drawer-header">
              <h3 style={{ fontSize: '1.25rem' }}>Student Profile Detail</h3>
              <button 
                onClick={() => setDrawerOpen(false)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-secondary))' }}
              >
                <X size={20} />
              </button>
            </div>
            
            {drawerLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1 }}>
                <div className="loader-spinner"></div>
              </div>
            ) : selectedStudent && (
              <>
                <div className="drawer-body">
                  
                  {/* Photo & Main Details */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '1px solid hsla(var(--border-glass))', background: '#0f172a' }}>
                      {selectedStudent.photo_url ? (
                        <img 
                          src={selectedStudent.photo_url} 
                          alt="Profile" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'hsl(var(--text-muted))' }}>
                          <Users size={32} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.2rem' }}>{selectedStudent.full_name}</h4>
                      <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>UT No: {selectedStudent.ut_no || 'N/A'}</p>
                      <span className={`badge badge-${selectedStudent.profile_status}`} style={{ marginTop: '6px' }}>
                        {selectedStudent.profile_status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Profile Edit requests inside drawer */}
                  {selectedStudent.profile_status === 'pending_edit' && (
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                      <h5 style={{ fontSize: '0.9rem', color: 'hsl(var(--warning))', marginBottom: '4px' }}>Pending Edit Access Request</h5>
                      
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '12px', lineHeight: '1.4' }}>
                        This student has requested access to modify their profile details. Approve request to unlock edits.
                      </p>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          onClick={async () => {
                            const reqRes = await fetch(`${API_URL}/admin/edit-requests`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const requestsList = await reqRes.json();
                            const activeReq = requestsList.find(r => r.student_id === selectedStudent.id && r.status === 'pending');
                            if (activeReq) {
                              await handleRequestStatus(activeReq.id, 'approve');
                            } else {
                              showToast('Could not find active request ID.', 'error');
                            }
                          }}
                        >
                          Approve Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Standard student details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '4px' }}>Personal Info ({selectedStudent.student_type === 'non_blossom' ? 'Non-Blossom' : 'Blossom Trust'})</p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Phone Number:</span>
                      <span style={{ fontWeight: '500' }}>{selectedStudent.phone_number || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>NIC Number:</span>
                      <span style={{ fontWeight: '500' }}>{selectedStudent.nic_number || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>District:</span>
                      <span style={{ fontWeight: '500' }}>{selectedStudent.district || '-'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>Email Address:</span>
                      <span style={{ fontWeight: '500' }}>{selectedStudent.email || '-'}</span>
                    </div>

                    {selectedStudent.student_type !== 'non_blossom' ? (
                      <>
                        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', fontWeight: '600', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '4px', borderTop: '1px solid hsla(var(--border-glass))', paddingTop: '12px' }}>Bank Details</p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Bank Name:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.bank_name || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Branch Name:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.branch_name || selectedStudent.branch || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Branch Code:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.branch_code || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Account No:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.account_no || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Beneficiary:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.beneficiary_name || '-'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', fontWeight: '600', letterSpacing: '0.05em', marginTop: '8px', marginBottom: '4px', borderTop: '1px solid hsla(var(--border-glass))', paddingTop: '12px' }}>Course & Academic Details</p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Course Name:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.course_name || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Batch:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.batch || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>Batch Year:</span>
                          <span style={{ fontWeight: '500' }}>{selectedStudent.batch_year || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Administrative details form */}
                  <form onSubmit={saveAdminFields}>
                    <h4 style={{ fontSize: '1rem', borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '8px', marginBottom: '16px' }}>
                      Admin Managed Settings
                    </h4>

                    {/* Blossom Trust Amount depending on Student Type */}
                    {selectedStudent.student_type !== 'non_blossom' && (
                      <div className="form-group" style={{ marginBottom: '20px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '14px' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <DollarSign size={14} color="hsl(var(--primary-hover))" /> Blossom Trust Amount (LKR)
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 25000"
                          value={adminFieldInputs.blossomTrustAmount}
                          onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, blossomTrustAmount: e.target.value }))}
                        />
                        <p style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '6px' }}>
                          This amount is visible to the student in read-only mode.
                        </p>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">{settings.admin_col1_title}</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Employed"
                        value={adminFieldInputs.adminCol1Val}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, adminCol1Val: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">{settings.admin_col2_title}</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. WSO2"
                        value={adminFieldInputs.adminCol2Val}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, adminCol2Val: e.target.value }))}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label className="form-label">{settings.admin_col3_title}</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 50000"
                        value={adminFieldInputs.adminCol3Val}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, adminCol3Val: e.target.value }))}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label className="form-label">Course Completion Status</label>
                      <select
                        className="form-select"
                        value={adminFieldInputs.courseCompletionStatus || ''}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, courseCompletionStatus: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Course Completion Status</option>
                        <option value="Completed">Completed</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Not Started">Not Started</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label className="form-label">Course Specialization</label>
                      <select
                        className="form-select"
                        value={adminFieldInputs.courseSpecialization || ''}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, courseSpecialization: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Specialization</option>
                        <option value="Full Stack Development">Full Stack Development</option>
                        <option value="Front End">Front End</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label className="form-label">Employment Status</label>
                      <select
                        className="form-select"
                        value={adminFieldInputs.employmentStatus || ''}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, employmentStatus: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Employment Status</option>
                        <option value="Software Industry Employment">Software Industry Employment</option>
                        <option value="Other Industry Employment">Other Industry Employment</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                      <label className="form-label">Other Status</label>
                      <select
                        className="form-select"
                        value={adminFieldInputs.otherStatus || ''}
                        onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, otherStatus: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Other Status</option>
                        <option value="Higher Study">Higher Study</option>
                        <option value="Unemployment">Unemployment</option>
                        <option value="Foreign">Foreign</option>
                      </select>
                    </div>

                    {/* Dropout configuration */}
                    <div style={{ marginBottom: '20px', borderTop: '1px solid hsla(var(--border-glass))', paddingTop: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'hsl(var(--text-secondary))' }}>
                        <input 
                          type="checkbox" 
                          checked={String(adminFieldInputs.dropout_status) === "true" || Number(adminFieldInputs.dropout_status) === 1}
                          onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, dropout_status: e.target.checked }))}
                        /> Mark as Dropout
                      </label>
                      
                      {(String(adminFieldInputs.dropout_status) === "true" || Number(adminFieldInputs.dropout_status) === 1) && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Reason for Dropout</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. Financial difficulties"
                              value={adminFieldInputs.dropout_reason}
                              onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, dropout_reason: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Dropout Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={adminFieldInputs.dropout_date}
                              onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, dropout_date: e.target.value }))}
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Low Alternance configuration */}
                    <div style={{ marginBottom: '24px', borderTop: '1px solid hsla(var(--border-glass))', paddingTop: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', color: 'hsl(var(--text-secondary))' }}>
                        <input 
                          type="checkbox" 
                          checked={adminFieldInputs.isLowAlternance}
                          onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, isLowAlternance: e.target.checked }))}
                        /> Mark as Low Alternance
                      </label>
                      
                      {adminFieldInputs.isLowAlternance && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: '8px', padding: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Reason for Low Alternance</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. Transportation issues"
                              value={adminFieldInputs.lowAlternanceReason}
                              onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, lowAlternanceReason: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Alternance Hours (Attendance)</label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="e.g. 20"
                              value={adminFieldInputs.lowAlternanceHours}
                              onChange={(e) => setAdminFieldInputs(prev => ({ ...prev, lowAlternanceHours: e.target.value }))}
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ width: '100%', gap: '8px' }}
                      disabled={saveLoading}
                    >
                      <Save size={16} /> {saveLoading ? 'Saving...' : 'Save Administrative Fields'}
                    </button>
                  </form>

                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Settings Modal (Modify Column Titles) */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders color="hsl(var(--primary))" size={20} /> Edit Administrative Column Titles
            </h3>
            
            <form onSubmit={saveCustomHeaders}>
              <div className="form-group">
                <label className="form-label">Admin Column 1 Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsForm.adminCol1Title}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, adminCol1Title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Admin Column 2 Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsForm.adminCol2Title}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, adminCol2Title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">Admin Column 3 Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsForm.adminCol3Title}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, adminCol3Title: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowSettingsModal(false)}
                  disabled={settingsLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={settingsLoading}
                >
                  {settingsLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
