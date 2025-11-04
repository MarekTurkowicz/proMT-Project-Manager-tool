import React from "react";
import { useMeQuery, useLogoutMutation } from "../../auth/authApi";
import "./HeaderBar.css";
import defaultAvatar from "../../../assets/react.svg";

export default function HeaderBar() {
  const { data: me } = useMeQuery();
  const [logout, { isLoading }] = useLogoutMutation();
  const [open, setOpen] = React.useState(false);

  const display = me?.username ?? "User";
  const avatarUrl = defaultAvatar; // 🔹 teraz zawsze lokalny obrazek

  async function handleLogout() {
    try {
      await logout().unwrap();
      window.location.href = "/login";
    } catch {
      alert("Logout failed");
    }
  }

  function goProfile() {
    window.location.href = "/profile";
  }

  return (
    <header className="hb">
      <a className="hb__logo" href="/dashboard">
        PM App
      </a>

      <div className="hb__right">
        {me ? (
          <div
            className="hb__account"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setOpen(false);
            }}
          >
            <button
              className="hb__accountBtn"
              onClick={() => setOpen((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <img className="hb__avatar" src={avatarUrl} alt={display} />
              <span className="hb__name">{display}</span>
              <svg
                className={`hb__chev ${open ? "hb__chev--open" : ""}`}
                viewBox="0 0 20 20"
                aria-hidden
              >
                <path
                  d="M5.5 7.5l4.5 4 4.5-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {open && (
              <div className="hb__menu" role="menu">
                <button className="hb__menuItem" onClick={goProfile}>
                  Profil
                </button>
                <button
                  className="hb__menuItem hb__logout"
                  onClick={handleLogout}
                  disabled={isLoading}
                >
                  {isLoading ? "Wylogowywanie…" : "Wyloguj"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <a className="hb__btnLink" href="/login">
            Zaloguj
          </a>
        )}
      </div>
    </header>
  );
}
