import { Download, FileSpreadsheet } from "lucide-react";

interface DataGridProps {
  csvData: string;
  onDownload: () => void;
}

function getColLabel(index: number) {
  let label = "";
  let curr = index;
  while (curr >= 0) {
    label = String.fromCharCode(65 + (curr % 26)) + label;
    curr = Math.floor(curr / 26) - 1;
  }
  return label;
}

export default function DataGrid({ csvData, onDownload }: DataGridProps) {
  const rows = csvData.split('\n').filter(r => r.length > 0).map(r => r.split(','));
  const maxCols = Math.max(...rows.map(r => r.length), 1);

  return (
    <div className="flex flex-col h-full bg-[#080d16] border border-emerald-500/20 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-emerald-500/15 bg-gradient-to-r from-[#0c1322] to-[#0a101b] px-4 py-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={14} className="text-emerald-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
            Active CSV Data Grid
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {rows.length} Rows × {maxCols} Cols
          </span>
        </div>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 text-emerald-300 transition-all shadow-sm"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-[#060911]">
        <table className="w-full text-xs text-left text-slate-300 border-collapse font-mono">
          <thead>
            <tr>
              <th className="px-2 py-1.5 border border-white/5 bg-[#0d1424] w-12 sticky top-0 z-20 text-[10px] text-slate-500 text-center select-none">
                #
              </th>
              {Array.from({ length: maxCols }).map((_, i) => (
                <th 
                  key={i} 
                  className="px-3 py-1.5 border border-white/5 bg-[#0d1424] font-semibold text-center min-w-[70px] sticky top-0 z-10 text-[11px] text-emerald-400/90 select-none"
                >
                  {getColLabel(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cols, rIndex) => (
              <tr key={rIndex} className="hover:bg-emerald-500/[0.04] transition-colors">
                <td className="px-2 py-1 border border-white/5 bg-[#0a0f1d] font-semibold text-center text-slate-500 sticky left-0 z-10 select-none text-[10px]">
                  {rIndex + 1}
                </td>
                {Array.from({ length: maxCols }).map((_, cIndex) => {
                  const val = cols[cIndex] !== undefined ? cols[cIndex].trim() : "";
                  const isNum = !isNaN(Number(val)) && val !== "";
                  return (
                    <td 
                      key={cIndex} 
                      className={`px-3 py-1 border border-white/5 truncate max-w-[150px] ${
                        isNum ? "text-cyan-300 text-right" : "text-slate-300"
                      }`}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
