
"use client";

import { use } from "react";
import { TCODE_MAP } from "@/lib/tcode-registry";
import { AlertCircle } from "lucide-react";

export default function TcodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upperCode = code.toUpperCase();
  const tcodeInfo = TCODE_MAP[upperCode];

  if (!tcodeInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] w-full space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Invalid T-Code: {upperCode}</h2>
          <p className="text-muted-foreground">The transaction code you entered does not exist or you do not have permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
      {tcodeInfo.component}
    </div>
  );
}


