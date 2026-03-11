import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  onClose: () => void;
}

export function PdfViewer({ url, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Failed to load PDF:', error);
    setError(error);
    setLoading(false);
  }

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setPageNumber(prev => Math.min(prev + 1, numPages || 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setPageNumber(prev => Math.max(prev - 1, 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, onClose]);

  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <div className="pdf-modal-content" onClick={e => e.stopPropagation()}>
        <div className="pdf-modal-header">
          <h3>PDF 预览</h3>
          <div className="pdf-controls">
            {numPages && (
              <span className="pdf-page-info">
                第 {pageNumber} 页 / 共 {numPages} 页
              </span>
            )}
            <button 
              onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
              disabled={pageNumber <= 1}
              className="btn small"
            >
              上一页
            </button>
            <button 
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || 1))}
              disabled={pageNumber >= (numPages || 1)}
              className="btn small"
            >
              下一页
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="btn small primary">
              新窗口打开 / 下载
            </a>
            <button onClick={onClose} className="btn small ghost">关闭</button>
          </div>
        </div>
        
        <div className="pdf-document-container">
          {loading && <div className="pdf-loading">加载中... (大文件可能需要较长时间)</div>}
          {error && (
            <div className="pdf-error">
              <p>加载失败，可能跨域限制或文件不存在。</p>
              <a href={url} target="_blank" rel="noreferrer" className="btn primary">
                直接下载文件
              </a>
            </div>
          )}
          {!error && (
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
              className="pdf-document"
            >
              <Page 
                pageNumber={pageNumber} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                width={Math.min(window.innerWidth * 0.9 - 40, 900)}
                className="pdf-page"
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
