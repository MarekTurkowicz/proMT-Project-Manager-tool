import { useProject } from "../context/ProjectContext";
import { usePickFundingsQuery } from "../../tasks/tasksApi";

export default function ProjectFundingsTab() {
  const project = useProject();
  const { data: fundingOptions = [] } = usePickFundingsQuery();

  const items = fundingOptions.filter((f) =>
    project.funding_ids.includes(f.id)
  );

  if (items.length === 0) {
    return <div className="card centered muted">No fundings linked.</div>;
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Linked fundings</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((f) => (
          <li key={f.id} style={{ marginBottom: 8 }}>
            <a className="pd-link" href={`/dashboard/fundings?focus=${f.id}`}>
              {f.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
