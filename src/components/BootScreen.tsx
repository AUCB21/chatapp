"use client";

interface BootScreenProps {
  progress: number; // 0–100
  label: string;
}

export default function BootScreen({ progress, label }: BootScreenProps) {
  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background">
      {/* Subtle grid background — matches login page */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative flex flex-col items-center gap-8">
        {/* EPS Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.svg"
          alt="EPS Chat"
          width={200}
          height={100}
          className="select-none"
        />

        {/* Progress bar */}
        <div className="w-56 flex flex-col items-center gap-3">
          <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #1E40AF, #8B5CF6)",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
