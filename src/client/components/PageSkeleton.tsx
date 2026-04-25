export function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen page-surface">
      <div className="breadcrumb">
        <div className="skeleton h-[14px] w-[52px] rounded" />
        <span className="sep">/</span>
        <div className="skeleton h-[14px] w-[72px] rounded" />
        <span className="sep">/</span>
        <div className="skeleton h-[14px] w-[120px] rounded" />
      </div>

      <div className="mx-auto w-full max-w-[720px] px-6 sm:px-12">
        <div className="pt-24">
          <div className="skeleton h-[72px] w-[72px] rounded-lg mb-3" />
          <div className="skeleton h-[44px] w-[60%] rounded mb-6 mt-4" />
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
