/** Official Plugg artwork, shared by the admin shell and authentication states. */
export function AdminBrand({ markOnly }: { markOnly?: boolean } = {}) {
  return (
    <span className="ad-brand-lockup">
      <span className="ad-logo-tile">
        <img
          className="ad-official-logo"
          src="/admin/plugg-logo.png"
          alt="Plugg"
          width={32}
          height={32}
        />
      </span>
      {!markOnly && (
        <>
          <span className="ad-wordmark" aria-hidden="true">
            plugg
          </span>
          <span className="ad-brand-divider" />
          <span className="ad-brand-caption">Admin</span>
        </>
      )}
    </span>
  );
}

