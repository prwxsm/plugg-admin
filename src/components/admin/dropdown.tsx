import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface AdminDropdownOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "green" | "amber" | "red" | "blue";
  disabled?: boolean;
}

export interface AdminDropdownProps<T extends string = string> {
  value: T;
  options: AdminDropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  fullWidth?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AdminDropdown<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select an option…",
  label,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "left",
  fullWidth = false,
  searchable = false,
  searchPlaceholder = "Filter options…",
  disabled = false,
  size = "md",
}: AdminDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!open) {
      setSearch("");
    }
  }, [open, searchable]);

  const selectedOption = options.find((o) => o.value === value);
  const SelectedIcon = selectedOption?.icon;

  const filteredOptions = searchable && search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase())) ||
        (o.badge && o.badge.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const toneClass = (tone?: string) => {
    switch (tone) {
      case "green":
        return "ad-dropdown-tone-green";
      case "amber":
        return "ad-dropdown-tone-amber";
      case "red":
        return "ad-dropdown-tone-red";
      case "blue":
        return "ad-dropdown-tone-blue";
      default:
        return "";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`ad-dropdown-container ${fullWidth ? "full-width" : ""} ${className}`}
    >
      {label && <span className="ad-dropdown-label">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`ad-dropdown-trigger size-${size} ${open ? "is-open" : ""} ${fullWidth ? "w-full" : ""} ${buttonClassName}`}
      >
        <div className="ad-dropdown-trigger-content">
          {SelectedIcon && <SelectedIcon size={14} className="ad-dropdown-icon shrink-0" />}
          <span className="ad-dropdown-trigger-text">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className={`ad-dropdown-badge ${toneClass(selectedOption.tone)}`}>
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`ad-dropdown-chevron ${open ? "is-expanded" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`ad-dropdown-menu align-${align} ${menuClassName}`}
        >
          {searchable && (
            <div className="ad-dropdown-search">
              <Search size={13} className="ad-dropdown-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="ad-dropdown-search-input"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  className="ad-dropdown-search-clear"
                  onClick={() => setSearch("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="ad-dropdown-list">
            {filteredOptions.length === 0 ? (
              <div className="ad-dropdown-empty">No matching options</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setOpen(false);
                      }
                    }}
                    className={`ad-dropdown-item ${isSelected ? "is-selected" : ""} ${opt.disabled ? "is-disabled" : ""}`}
                  >
                    <div className="ad-dropdown-item-left">
                      {Icon && (
                        <Icon
                          size={14}
                          className={`ad-dropdown-item-icon ${isSelected ? "text-primary" : "text-muted"}`}
                        />
                      )}
                      <div className="ad-dropdown-item-content">
                        <span className="ad-dropdown-item-label">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="ad-dropdown-item-sublabel">{opt.sublabel}</span>
                        )}
                      </div>
                    </div>

                    <div className="ad-dropdown-item-right">
                      {opt.badge && (
                        <span className={`ad-dropdown-badge ${toneClass(opt.tone)}`}>
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={14} className="ad-dropdown-check shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
