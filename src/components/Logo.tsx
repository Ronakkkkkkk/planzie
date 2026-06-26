import { ClipboardCheck } from 'lucide-react';

export function Logo({ className = "w-8 h-8", textClassName = "text-xl font-bold" }: { className?: string; textClassName?: string }) {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <ClipboardCheck className={`${className} text-teal-600`} />
      <span className={`${textClassName} tracking-tight text-teal-950 font-sans`}>Planzie</span>
    </div>
  );
}
