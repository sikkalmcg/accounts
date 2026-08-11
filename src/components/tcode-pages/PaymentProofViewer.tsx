
"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { jsPDF } from "jspdf";


// This sets up the PDF.js worker.
// Next.js will automatically handle bundling and making this file available.
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

interface PaymentProofViewerProps {
  proofData: string;
  invoiceNumber: string;
  fileName?: string;
}

const PaymentProofViewer = ({ proofData, invoiceNumber, fileName }: PaymentProofViewerProps) => {
  const [fileType, setFileType] = useState<"pdf" | "image" | "unknown">("unknown");
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [numPages, setNumPages] = useState<number | null>(null);

  useEffect(() => {
    if (!proofData) return;

    const isPdf = proofData.startsWith("data:application/pdf");
    const isImage = proofData.startsWith("data:image/");

    if (isPdf) {
      setFileType("pdf");
      setPdfData(proofData);
    } else if (isImage) {
      setFileType("image");
      // Convert image to PDF
      const doc = new jsPDF();
      const img = new Image();
      img.src = proofData;
      img.onload = () => {
        const imgProps = doc.getImageProperties(proofData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(proofData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        setPdfData(doc.output("datauristring"));
      };
    } else {
      setFileType("unknown");
    }
  }, [proofData]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsPasswordProtected(false);
  };

  const onDocumentLoadError = (error: Error) => {
    if (error.name === 'PasswordException') {
      setIsPasswordProtected(true);
    } else {
      console.error("Failed to load PDF", error);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The component will re-render with the new password
  };
  
  const downloadFilename = () => {
    let originalFilename = "proof";
    if (fileName) {
        originalFilename = fileName;
    } else if (proofData) {
        const match = proofData.match(/name=([^;]+)/);
        if (match) {
            originalFilename = match[1];
        }
    }
    
    const extension = originalFilename.split('.').pop();
    return `${invoiceNumber} - ${originalFilename}`;
  }

  if (!proofData) {
    return <div className="p-4 text-center">No proof available.</div>;
  }

  if (fileType === "unknown") {
    return <div className="p-4 text-center">Unsupported file type.</div>;
  }

  return (
    <div className="p-4 bg-gray-200">
      {isPasswordProtected && (
        <form onSubmit={handlePasswordSubmit} className="p-4 bg-white shadow-md mb-4">
          <p className="mb-2 font-bold">This PDF is password protected.</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              placeholder="Enter PDF Password"
              className="border p-2 flex-grow"
            />
            <button type="submit" className="bg-blue-500 text-white p-2">
              Unlock
            </button>
          </div>
        </form>
      )}

      {pdfData && (
        <div className="max-h-[70vh] overflow-auto">
          <Document
            file={pdfData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={{ password: pdfPassword }}
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <Page key={`page_${index + 1}`} pageNumber={index + 1} />
            ))}
          </Document>
        </div>
      )}
      
      <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3 mt-4">
        <a
          href={proofData}
          download={downloadFilename()}
          className="h-8 rounded-none bg-[#333e4f] text-white text-[11px] font-bold uppercase px-6 shadow-sm flex items-center gap-2 hover:bg-gray-700"
        >
          Download Original
        </a>
      </div>
    </div>
  );
};

export default PaymentProofViewer;
