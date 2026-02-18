"use client";

import { useEffect, useMemo, useState } from "react";

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  const tone =
    toast.type === "success"
      ? "bg-green-600"
      : toast.type === "error"
      ? "bg-red-600"
      : "bg-blue-600";
  return (
    <div className="fixed top-6 right-6 z-50">
      <div className={`${tone} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white"
        >
          x
        </button>
      </div>
    </div>
  );
};

const maskKey = (value) => {
  if (!value) return "N/A";
  return "●●●●●●";
};

const getUserId = (user) => {
  if (!user) return "";
  if (typeof user.id === "string" && user.id) return user.id;
  if (typeof user._id === "string" && user._id) return user._id;
  if (user._id && typeof user._id === "object" && typeof user._id.$oid === "string") {
    return user._id.$oid;
  }
  return "";
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [visibleKeygens, setVisibleKeygens] = useState(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [editingUser, setEditingUser] = useState(null);
  const [editValues, setEditValues] = useState({
    name: "",
    email: "",
    password: "",
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const name = user?.name?.toLowerCase() || "";
      const email = user?.email?.toLowerCase() || "";
      return name.includes(term) || email.includes(term);
    });
  }, [query, users]);

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to load users.");
        }
        const data = await response.json();
        if (isMounted) {
          const mapped = Array.isArray(data) ? data : [];
          setUsers(mapped);
        }
      } catch (error) {
        showToast("error", error.message || "Failed to load users.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditValues((prev) => ({ ...prev, [name]: value }));
  };

  const openEdit = (user) => {
    if (!user) return;
    setEditingUser(user);
    setEditValues({
      name: user.name || "",
      email: user.email || "",
      password: "",
    });
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditValues({ name: "", email: "", password: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setToast(null);

    if (!formValues.name || !formValues.email || !formValues.password) {
      showToast("error", "Name, email, and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create user.");
      }

      const created = payload?.user;
      if (created) {
        setUsers((prev) => [created, ...prev]);
      }

      setFormValues({ name: "", email: "", password: "" });
      showToast("success", "User created successfully.");
    } catch (error) {
      showToast("error", error.message || "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingUser) return;
    
    if (!editValues.name || !editValues.name.trim()) {
      showToast("error", "Name is required.");
      return;
    }

    setIsUpdating(true);
    try {
      const updatePayload = {
        name: editValues.name.trim()
      };
      
      if (editValues.password && editValues.password.trim()) {
        updatePayload.password = editValues.password;
      }

      const editId = getUserId(editingUser);
      if (!editId) {
        showToast("error", "User id is missing.");
        return;
      }

      const response = await fetch(`/api/users/${encodeURIComponent(editId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update user.");
      }

      const updated = payload?.user;
      if (updated) {
        setUsers((prev) =>
          prev.map((user) => {
            const id = getUserId(user);
            const updatedId = getUserId(updated);
            return id && updatedId && id === updatedId ? { ...user, ...updated } : user;
          })
        );
      }

      showToast("success", "User updated successfully.");
      closeEdit();
    } catch (error) {
      showToast("error", error.message || "Failed to update user.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("success", "Keygen copied to clipboard.");
    } catch (error) {
      showToast("error", "Failed to copy keygen.");
    }
  };

  const toggleKeygenVisibility = (userId) => {
    setVisibleKeygens((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleDelete = async (userId) => {
    if (!userId) {
      showToast("error", "User id is missing.");
      return;
    }
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete user.");
      }
      setUsers((prev) => prev.filter((user) => getUserId(user) !== userId));
      showToast("success", "User deleted.");
    } catch (error) {
      showToast("error", error.message || "Failed to delete user.");
    }
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 px-4">
          <form
            onSubmit={handleUpdate}
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-200 px-6 py-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
                <p className="text-sm text-gray-600 mt-1">Update user profile details.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900"
                aria-label="Close edit modal"
              >
                x
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="edit-name"
                  name="name"
                  value={editValues.name}
                  onChange={handleEditChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={editValues.email}
                  onChange={handleEditChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-gray-100 cursor-not-allowed"
                  disabled
                  readOnly
                />
              </div>
              <div>
                <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  id="edit-password"
                  name="password"
                  type="password"
                  value={editValues.password}
                  onChange={handleEditChange}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-4"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Create User</h2>
          <p className="text-sm text-gray-600 mt-1">Add a new user and generate a keygen.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              name="name"
              value={formValues.name}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              {!isMounted ? (
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formValues.password}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                  suppressHydrationWarning
                />
              ) : (
                <>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formValues.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating..." : "Create User"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Users</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage users and copy their keygen tokens.
            </p>
          </div>
          <div className="w-full md:w-64">
            <input
              type="search"
              placeholder="Search name or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-sm text-gray-500">No users yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full table-fixed text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="w-40 px-4 py-3 text-left font-semibold">Name</th>
                  <th className="w-56 px-4 py-3 text-left font-semibold">Email</th>
                  <th className="w-[360px] px-4 py-3 text-left font-semibold">Keygen</th>
                  <th className="w-32 px-4 py-3 text-right font-semibold">Options</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const id = getUserId(user);
                  const isVisible = visibleKeygens.has(id);
                  return (
                    <tr key={id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900 truncate">{user?.name}</td>
                      <td className="px-4 py-3 truncate">{user?.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[360px]">
                          <span className={`text-xs text-gray-600 font-mono ${isVisible ? "break-all whitespace-normal" : "whitespace-nowrap"}`}>
                            {user?.keygen ? (isVisible ? user?.keygen : maskKey(user?.keygen)) : "N/A"}
                          </span>
                          {user?.keygen ? (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleKeygenVisibility(id)}
                                className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                aria-label={isVisible ? "Hide keygen" : "Show keygen"}
                              >
                                {isVisible ? (
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M3 3l18 18" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(user?.keygen)}
                                className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                aria-label="Copy keygen"
                              >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(id)}
                            className="inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
