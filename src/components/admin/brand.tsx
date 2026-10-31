/** Official Plugg artwork, shared by the admin shell and authentication states. */
export function AdminBrand() {
  return (
    <span className="ad-brand-lockup">
      <span className="ad-logo-tile">
        <img
          className="ad-official-logo"
          src="/admin/plugg-logo.png"
          alt="Plugg"
          width={32}
          height={31}
        />
      </span>
      <span className="ad-wordmark" aria-hidden="true">
        plugg
      </span>
      <span className="ad-brand-divider" />
      <span className="ad-brand-caption">Admin</span>
    </span>
  );
}
