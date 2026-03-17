export function PageHeader({ pretitle, title }) {
  return (
    <div className="page-header d-print-none mb-3">
      <div className="row align-items-center">
        <div className="col">
          <div className="page-pretitle">{pretitle}</div>
          <h2 className="page-title">{title}</h2>
        </div>
      </div>
    </div>
  )
}
