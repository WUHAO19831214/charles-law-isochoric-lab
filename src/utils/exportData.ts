import { ExperimentRecord } from '../types/physics';

/**
 * 导出实验数据为标准 CSV 文件 (含 UTF-8 BOM，防止 Excel 中文乱码)
 */
export function exportToCSV(records: ExperimentRecord[], defaultVolume = 50.0): void {
  if (records.length === 0) {
    alert('暂无记录数据可导出');
    return;
  }

  const headers = ['序号', '时间 t (s)', '压强 p (kPa)', '热力学温度 T (K)', '摄氏温度 t (℃)', '体积 V (mL)'];
  const rows = records.map((r, idx) => [
    idx + 1,
    r.time.toFixed(1),
    r.pressure.toFixed(2),
    r.temperature.toFixed(2),
    r.celsius.toFixed(2),
    (r.volume || defaultVolume).toFixed(1),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  // 添加 UTF-8 BOM
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.setAttribute('download', `气体等容变化实验数据_${timestampStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
