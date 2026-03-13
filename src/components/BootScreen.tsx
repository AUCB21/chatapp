"use client";

interface BootScreenProps {
  progress: number; // 0–100
  label: string;
}

export default function BootScreen({ progress, label }: BootScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
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
        <svg
          width="200"
          height="100"
          viewBox="0 0 400 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="select-none"
        >
          <defs>
            <linearGradient
              id="eps_gradient"
              x1="0"
              y1="100"
              x2="400"
              y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>

          <g id="logo-mark">
            <path
              d="M110 60C82.3858 60 60 82.3858 60 110C60 124.341 66.0142 137.278 75.666 146.438L65 170L95.5 158.5C100.1 159.4 104.9 160 110 160C137.614 160 160 137.614 160 110C160 82.3858 137.614 60 110 60Z"
              stroke="url(#eps_gradient)"
              strokeWidth="8"
              strokeLinejoin="round"
            />
            <path
              d="M165 60C137.386 60 115 82.3858 115 110C115 124.341 121.014 137.278 130.666 146.438L120 170L150.5 158.5C155.1 158.5 159.9 160 165 160C192.614 160 215 137.614 215 110C215 82.3858 192.614 60 165 60Z"
              stroke="url(#eps_gradient)"
              strokeWidth="8"
              strokeLinejoin="round"
              fill="white"
              fillOpacity="0.1"
            />
          </g>

          <text
            x="235"
            y="125"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="64"
            fill="url(#eps_gradient)"
          >
            EPS
          </text>
          <text
            x="237"
            y="155"
            fontFamily="Arial, sans-serif"
            fontWeight="400"
            fontSize="20"
            fill="#64748B"
            letterSpacing="2"
          >
            CHATTING
          </text>
        </svg>

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
