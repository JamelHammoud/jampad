export function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-full page-surface">
      <div className="breadcrumb">
        <div className="skeleton h-[14px] w-[52px] rounded" />
        <span className="sep">/</span>
        <div className="skeleton h-[14px] w-[72px] rounded" />
        <span className="sep">/</span>
        <div className="skeleton h-[14px] w-[120px] rounded" />
      </div>

      <div className="mx-auto w-full max-w-[720px] px-4 sm:px-12">
        <div className="pt-6 sm:pt-24">
          <div className="skeleton h-14 w-14 sm:h-18 sm:w-18 rounded-lg mb-3" />
          <div className="skeleton h-9 sm:h-11 w-[60%] rounded mb-6 mt-4" />
          <div className="space-y-3">
            <div className="skeleton h-[14px] w-[92%] rounded" />
            <div className="skeleton h-[14px] w-[78%] rounded" />
            <div className="skeleton h-[14px] w-[85%] rounded" />
            <div className="skeleton h-[14px] w-[40%] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
