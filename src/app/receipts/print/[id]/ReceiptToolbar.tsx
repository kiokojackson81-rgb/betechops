'use client';

type ReceiptToolbarProps = {
  receiptId: string;
};

export default function ReceiptToolbar({ receiptId }: ReceiptToolbarProps) {
  const downloadUrl = `/api/receipts/${receiptId}/pdf`;
  const toolbarStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginBottom: '16px',
  };
  const buttonStyle = {
    border: '1px solid #111827',
    background: '#111827',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  };
  const linkStyle = {
    border: '1px solid #7A2020',
    background: '#7A2020',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    textDecoration: 'none',
  };

  return (
    <div style={toolbarStyle}>
      <button type="button" style={buttonStyle} onClick={() => window.print()}>
        Print
      </button>
      <a href={downloadUrl} target="_blank" rel="noreferrer" style={linkStyle}>
        Download PDF
      </a>
    </div>
  );
}
