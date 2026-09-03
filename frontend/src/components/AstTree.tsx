import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { AstNode } from "../lib/types";

function matches(node: AstNode, filter: string): boolean {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if (node.label.toLowerCase().includes(f)) return true;
  return node.children.some((c) => matches(c, f));
}

function TreeNode({ node, depth, filter }: { node: AstNode; depth: number; filter: string }) {
  const [manuallyOpen, setManuallyOpen] = useState<boolean | null>(null);
  const hasChildren = node.children.length > 0;
  const forceOpenForFilter = filter.length > 0;
  const open = manuallyOpen !== null ? manuallyOpen : forceOpenForFilter || depth < 3;

  if (!matches(node, filter)) return null;

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[13px] hover:bg-white/5"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => hasChildren && setManuallyOpen(!open)}
      >
        {hasChildren ? (
          open ? <ChevronDown size={12} className="shrink-0 text-slate-500" /> : <ChevronRight size={12} className="shrink-0 text-slate-500" />
        ) : (
          <span className="w-3" />
        )}
        <span className="font-mono text-indigo-300">{node.label}</span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((c, i) => (
            <TreeNode key={i} node={c} depth={depth + 1} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AstTree({ root, filter = "" }: { root: AstNode | null; filter?: string }) {
  if (!root) return <div className="p-4 text-sm text-slate-500">No AST available.</div>;
  return (
    <div className="p-3">
      <TreeNode node={root} depth={0} filter={filter} />
    </div>
  );
}
