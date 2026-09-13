import { SchedulePlan, DayOfWeek, DAYS_LIST } from '../types/schedule';
import { minutesToTime, timeToMinutes, getContrastTextColor, computeDayLayout } from './timeUtils';

export interface ImageExportOptions {
  theme: 'light' | 'dark';
  showWeekends: boolean;
  startHour: number;
  endHour: number;
}

/**
 * High-DPI Canvas-based schedule image exporter.
 * Generates a clean PNG snapshot suitable for phone wallpapers, printing, or sending to advisors.
 */
export async function exportScheduleToImage(
  plan: SchedulePlan,
  options: ImageExportOptions = { theme: 'light', showWeekends: false, startHour: 7, endHour: 21 }
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback gracefully if font loading check fails
    }
  }

  const isDark = options.theme === 'dark';
  const scale = 2; // Retina 2x

  const daysToRender = options.showWeekends
    ? DAYS_LIST
    : DAYS_LIST.filter(d => d.id !== 'saturday' && d.id !== 'sunday');

  const width = (options.showWeekends ? 1400 : 1200) * scale;
  const height = 900 * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  ctx.scale(scale, scale);
  const baseWidth = width / scale;
  const baseHeight = height / scale;

  // Background Colors
  const bgColor = isDark ? '#090d16' : '#f8fafc';
  const headerBg = isDark ? '#0f172a' : '#ffffff';
  const gridLineColor = isDark ? '#1e293b' : '#e2e8f0';
  const hourLineColor = isDark ? '#334155' : '#cbd5e1';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const timeGutterBg = isDark ? '#0f172a' : '#f1f5f9';

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Top Title Bar
  const headerHeight = 70;
  ctx.fillStyle = headerBg;
  ctx.fillRect(0, 0, baseWidth, headerHeight);

  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(baseWidth, headerHeight);
  ctx.stroke();

  // App & Plan Title
  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`Uniplan • ${plan.name}`, 24, 40);

  const totalCredits = plan.courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  ctx.fillStyle = textSecondary;
  ctx.font = '500 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${plan.courses.length} courses enrolled • ${totalCredits} total credit hours`, 24, 60);

  // Grid Dimensions
  const timeGutterWidth = 75;
  const calendarTop = headerHeight;
  const dayHeaderHeight = 40;
  const gridTop = calendarTop + dayHeaderHeight;
  const gridHeight = baseHeight - gridTop - 20;
  const gridWidth = baseWidth - timeGutterWidth - 20;
  const numDays = daysToRender.length;
  const colWidth = gridWidth / numDays;

  // Draw Top-Left Corner Header (Time Column Header with Clock Icon)
  ctx.fillStyle = isDark ? '#0f172a' : '#e2e8f0';
  ctx.fillRect(0, calendarTop, timeGutterWidth, dayHeaderHeight);

  // Draw Clock Icon inside top-left header cell
  const clockX = timeGutterWidth / 2;
  const clockY = calendarTop + dayHeaderHeight / 2;
  ctx.save();
  ctx.strokeStyle = textSecondary;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(clockX, clockY, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(clockX, clockY - 4.5);
  ctx.lineTo(clockX, clockY);
  ctx.lineTo(clockX + 3.2, clockY + 1.8);
  ctx.stroke();
  ctx.restore();

  // Draw Day Headers
  ctx.fillStyle = isDark ? '#131c31' : '#f1f5f9';
  ctx.fillRect(timeGutterWidth, calendarTop, gridWidth, dayHeaderHeight);

  // Horizontal border line under day & gutter header
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, calendarTop + dayHeaderHeight);
  ctx.lineTo(timeGutterWidth + gridWidth, calendarTop + dayHeaderHeight);
  ctx.stroke();

  daysToRender.forEach((day, index) => {
    const colX = timeGutterWidth + index * colWidth;
    ctx.strokeStyle = gridLineColor;
    ctx.beginPath();
    ctx.moveTo(colX, calendarTop);
    ctx.lineTo(colX, baseHeight - 20);
    ctx.stroke();

    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day.full, colX + colWidth / 2, calendarTop + 25);
  });

  // Gutter border
  ctx.strokeStyle = gridLineColor;
  ctx.beginPath();
  ctx.moveTo(timeGutterWidth + gridWidth, calendarTop);
  ctx.lineTo(timeGutterWidth + gridWidth, baseHeight - 20);
  ctx.stroke();

  // Draw Time Gutter Background
  ctx.fillStyle = timeGutterBg;
  ctx.fillRect(0, gridTop, timeGutterWidth, gridHeight);

  // Adaptive time boundaries: expand if any enrolled course falls outside default hours
  let startHour = options.startHour;
  let endHour = options.endHour;
  for (const c of plan.courses) {
    for (const s of c.sessions) {
      const sM = timeToMinutes(s.startTime);
      const eM = timeToMinutes(s.endTime);
      if (sM > 0) startHour = Math.min(startHour, Math.floor(sM / 60));
      if (eM > 0) endHour = Math.max(endHour, Math.ceil(eM / 60));
    }
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(startHour + 1, endHour));

  // Time Rows
  const totalMinutes = (endHour - startHour) * 60;
  const numHours = endHour - startHour;
  const hourHeight = gridHeight / numHours;

  for (let h = startHour; h <= endHour; h++) {
    const y = gridTop + (h - startHour) * hourHeight;

    // Line across grid
    ctx.strokeStyle = h === startHour || h === endHour ? hourLineColor : gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(timeGutterWidth, y);
    ctx.lineTo(timeGutterWidth + gridWidth, y);
    ctx.stroke();

    // Time Label in gutter (render all hours including the last hour)
    ctx.fillStyle = textSecondary;
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const label = minutesToTime(h * 60, true);

    let labelY = y + 4;
    if (h === startHour) {
      labelY = y + 12;
    } else if (h === endHour) {
      labelY = y - 4;
    }
    ctx.fillText(label, timeGutterWidth - 10, labelY);
  }

  // Draw Course Blocks
  daysToRender.forEach((dayObj, dayIndex) => {
    const day = dayObj.id;
    const colX = timeGutterWidth + dayIndex * colWidth;

    // Filter and compute layout for this day
    const itemsToLayout: any[] = [];
    plan.courses.forEach(course => {
      course.sessions.filter(s => s.day === day).forEach(session => {
        itemsToLayout.push({
          session,
          course,
          planId: plan.id,
          planName: plan.name,
          isGhost: false,
          hasConflict: false,
        });
      });
    });

    const layoutSessions = computeDayLayout(itemsToLayout);

    layoutSessions.forEach(({ course, session, colIndex, totalCols }) => {
      const sMin = timeToMinutes(session.startTime);
      const eMin = timeToMinutes(session.endTime);

      const topMin = Math.max(sMin, startHour * 60);
      const bottomMin = Math.min(eMin, endHour * 60);
      if (bottomMin <= topMin) return;

      const yTop = gridTop + ((topMin - startHour * 60) / totalMinutes) * gridHeight;
      const blockHeight = Math.max(28, ((bottomMin - topMin) / totalMinutes) * gridHeight);

      const pad = 3;
      // Adjust width/x based on column layout for overlapping courses
      const layoutColWidth = colWidth / totalCols;
      const bX = colX + (colIndex * layoutColWidth) + pad;
      const bY = yTop + pad;
      const bW = layoutColWidth - pad * 2;
      const bH = blockHeight - pad * 2;
      const radius = 6;

      // Draw rounded course block
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bX, bY, bW, bH, radius);
      } else {
        ctx.rect(bX, bY, bW, bH);
      }
      ctx.fillStyle = course.color || '#3B82F6';
      ctx.fill();

      // Block border
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';
      ctx.stroke();

      // Text inside block
      ctx.clip();
      const textCol = getContrastTextColor(course.color || '#3B82F6') === 'text-slate-900' ? '#0f172a' : '#ffffff';
      const textColSub = getContrastTextColor(course.color || '#3B82F6') === 'text-slate-900' ? '#334155' : 'rgba(255,255,255,0.85)';
      ctx.fillStyle = textCol;
      ctx.textAlign = 'left';

      // Course Code + Section
      const codeSec = course.section ? `${course.code}-${course.section}` : course.code;
      ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(codeSec, bX + 6, bY + 16);

      // Course Name if height permits
      if (bH > 42) {
        ctx.fillStyle = textColSub;
        ctx.font = '500 11px "Plus Jakarta Sans", system-ui, sans-serif';
        const truncatedName = course.name.length > 20 ? course.name.substring(0, 18) + '...' : course.name;
        ctx.fillText(truncatedName, bX + 6, bY + 31);
      }

      // Time and Room if height permits
      if (bH > 62) {
        ctx.fillStyle = textColSub;
        ctx.font = '400 10px "JetBrains Mono", monospace';
        const timeStr = `${minutesToTime(sMin)} - ${minutesToTime(eMin)}`;
        const roomStr = session.room ? ` • ${session.room}` : '';
        ctx.fillText(`${timeStr}${roomStr}`, bX + 6, bY + 46);
      }

      ctx.restore();
    });
  });

  const dataUrl = canvas.toDataURL('image/png');
  // Release backing GPU/canvas bitmap buffer immediately to avoid memory bloat
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

/**
 * Downloads the exported schedule image.
 */
export async function downloadScheduleImage(
  plan: SchedulePlan,
  options?: ImageExportOptions
): Promise<void> {
  const dataUrl = await exportScheduleToImage(plan, options);
  const link = document.createElement('a');
  link.href = dataUrl;
  const safeName = plan.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${safeName}_Schedule.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
