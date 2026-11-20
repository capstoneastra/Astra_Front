import { previewRoutes } from "../preview/paths";

export default function InternalPreviewLinks() {
  if (!import.meta.env.DEV) return null;

  return (
    <nav className="tw:mt-4" aria-label="내부 화면 미리보기">
      <p className="field-hint tw:mb-2">개발용 내부 화면 미리보기</p>
      <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
        {previewRoutes.map(({ path, label }) => (
          <a className="button button--secondary" key={path} href={path}>{label}</a>
        ))}
      </div>
    </nav>
  );
}
