interface EmptyStateCardProps {
  onAddCourse: () => void;
  onLoadDemo: () => void;
}

export function EmptyStateCard({ onAddCourse, onLoadDemo }: EmptyStateCardProps) {
  return (
    <div className="up-empty-plan" role="status">
      <h2>This plan is empty</h2>
      <p>Add a course, or load the demo semester.</p>
      <div className="up-empty-plan-actions">
        <button type="button" className="up-sheet-btn-primary up-chrome-btn" onClick={onAddCourse}>
          Add course
        </button>
        <button type="button" className="up-sheet-btn-secondary up-chrome-btn" onClick={onLoadDemo}>
          Load demo
        </button>
      </div>
    </div>
  );
}
