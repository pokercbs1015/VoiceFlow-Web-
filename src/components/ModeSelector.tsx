import { BriefcaseBusiness, GraduationCap } from "lucide-react";
import type { Mode } from "../types";

interface ModeSelectorProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const modes: Array<{
  value: Mode;
  label: string;
  icon: typeof GraduationCap;
}> = [
  { value: "student", label: "学生笔记", icon: GraduationCap },
  { value: "meeting", label: "会议纪要", icon: BriefcaseBusiness }
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="segmented-control" role="tablist" aria-label="整理模式">
      {modes.map((item) => {
        const Icon = item.icon;
        const selected = mode === item.value;

        return (
          <button
            aria-selected={selected}
            className={selected ? "selected" : ""}
            key={item.value}
            role="tab"
            type="button"
            onClick={() => onChange(item.value)}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
