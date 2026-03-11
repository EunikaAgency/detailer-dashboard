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

const normalizeText = (value) => String(value || "").trim();

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getDisplayUsername = (user) =>
  normalizeText(user?.username || user?.email || user?.name || "");

const getDisplayRepId = (user) => normalizeText(user?.repId || "");
const getDisplayRole = (user) => normalizeText(user?.role || "");

const IssuedCredentialCard = ({ credential, onCopy }) => {
  if (!credential) return null;

  return (
    <div className="bg-white rounded-2xl border border-green-200 shadow-sm px-6 py-5 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Credential Issued</h2>
        <p className="text-sm text-gray-600 mt-1">
          Share this exact username and password pair with the representative.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase text-gray-500">Username</div>
          <div className="mt-1 text-sm font-medium text-gray-900 break-words">{credential.username}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase text-gray-500">Created At</div>
          <div className="mt-1 text-sm font-medium text-gray-900 break-words">
            {formatDate(credential.createdAt)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="text-xs font-semibold uppercase text-gray-500">Password (Keygen)</div>
        <div className="mt-1 text-xs font-mono text-gray-900 break-all">{credential.password}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onCopy(credential.username)}
          className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          Copy Username
        </button>
        <button
          type="button"
          onClick={() => onCopy(credential.password)}
          className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          Copy Password
        </button>
      </div>
    </div>
  );
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [visibleKeygens, setVisibleKeygens] = useState(new Set());
  const [issuedCredential, setIssuedCredential] = useState(null);

  const [formValues, setFormValues] = useState({
    name: "",
    username: "",
    repId: "",
    role: "",
  });

  const [editingUser, setEditingUser] = useState(null);
  const [editValues, setEditValues] = useState({
    name: "",
    username: "",
    repId: "",
    role: "",
    reissueKeygen: false,
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) => {
      const name = normalizeText(user?.name).toLowerCase();
      const username = getDisplayUsername(user).toLowerCase();
      const repId = getDisplayRepId(user).toLowerCase();
      const role = getDisplayRole(user).toLowerCase();
      const email = normalizeText(user?.email).toLowerCase();
      return (
        name.includes(term) ||
        username.includes(term) ||
        repId.includes(term) ||
        role.includes(term) ||
        email.includes(term)
      );
    });
  }, [query, users]);

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to load users.");
        }

        const data = await response.json();
        if (!mounted) return;

        const mapped = Array.isArray(data) ? data : [];
        setUsers(mapped);
      } catch (error) {
        showToast("error", error.message || "Failed to load users.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openEdit = (user) => {
    if (!user) return;

    setEditingUser(user);
    setEditValues({
      name: normalizeText(user.name),
      username: getDisplayUsername(user),
      repId: getDisplayRepId(user),
      role: getDisplayRole(user),
      reissueKeygen: false,
    });
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditValues({
      name: "",
      username: "",
      repId: "",
      role: "",
      reissueKeygen: false,
    });
  };

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("success", "Copied to clipboard.");
    } catch {
      showToast("error", "Failed to copy.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setToast(null);
    setIssuedCredential(null);

    const payload = {
      createMode: "offline-credential",
      name: normalizeText(formValues.name),
      username: normalizeText(formValues.username),
      repId: normalizeText(formValues.repId),
      role: normalizeText(formValues.role),
    };

    if (!payload.name || !payload.username || !payload.repId || !payload.role) {
      showToast("error", "Representative name, username, Rep ID, and role are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Failed to issue credential.");
      }

      const created = body?.user;
      if (created && getUserId(created)) {
        setUsers((prev) => [created, ...prev]);
      }

      if (body?.issuedCredential) {
        setIssuedCredential(body.issuedCredential);
      }

      setFormValues({
        name: "",
        username: "",
        repId: "",
        role: "",
      });
      if (body?.keygenOnly) {
        showToast("success", "Offline keygen issued. User will be created after first online sync.");
      } else {
        showToast("success", "Offline credential issued successfully.");
      }
    } catch (error) {
      showToast("error", error.message || "Failed to issue credential.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingUser) return;

    const name = normalizeText(editValues.name);
    const username = normalizeText(editValues.username);
    const repId = normalizeText(editValues.repId);
    const role = normalizeText(editValues.role);

    if (!name || !username || !repId || !role) {
      showToast("error", "Name, username, Rep ID, and role are required.");
      return;
    }

    const updatePayload = {
      name,
      username,
      repId,
      role,
      reissueKeygen: Boolean(editValues.reissueKeygen),
    };

    setIsUpdating(true);
    try {
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
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Failed to update user.");
      }

      const updated = body?.user;
      if (updated) {
        setUsers((prev) =>
          prev.map((user) => {
            const id = getUserId(user);
            const updatedId = getUserId(updated);
            return id && updatedId && id === updatedId ? { ...user, ...updated } : user;
          })
        );
      }

      if (body?.issuedCredential) {
        setIssuedCredential(body.issuedCredential);
        showToast("success", "User updated and credential re-issued.");
      } else {
        showToast("success", "User updated successfully.");
      }

      closeEdit();
    } catch (error) {
      showToast("error", error.message || "Failed to update user.");
    } finally {
      setIsUpdating(false);
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
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Failed to delete user.");
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
                <h2 className="text-xl font-semibold text-gray-900">Edit Representative</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Update representative details or re-issue a credential.
                </p>
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
                  Representative Name
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
                <label htmlFor="edit-username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  id="edit-username"
                  name="username"
                  value={editValues.username}
                  onChange={handleEditChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-repId" className="block text-sm font-medium text-gray-700 mb-1">
                    OPPI
                  </label>
                  <input
                    id="edit-repId"
                    name="repId"
                    value={editValues.repId}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 mb-1">
                    Team
                  </label>
                  <input
                    id="edit-role"
                    name="role"
                    value={editValues.role}
                    onChange={handleEditChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="reissueKeygen"
                  checked={editValues.reissueKeygen}
                  onChange={handleEditChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Re-issue credential password
              </label>
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
          <h2 className="text-xl font-semibold text-gray-900">Issue Offline Credential</h2>
          <p className="text-sm text-gray-600 mt-1">
            Admin enters representative details. The password key is generated automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Representative Name
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
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              name="username"
              value={formValues.username}
              onChange={handleChange}
              placeholder="Issued login username"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label htmlFor="repId" className="block text-sm font-medium text-gray-700 mb-1">
              OPPI
            </label>
            <input
              id="repId"
              name="repId"
              value={formValues.repId}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Team
            </label>
            <input
              id="role"
              name="role"
              value={formValues.role}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Issuing..." : "Generate Username + Password"}
        </button>
      </form>

      <IssuedCredentialCard credential={issuedCredential} onCopy={handleCopy} />

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Representatives</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage issued accounts and copy keygen passwords.
            </p>
          </div>

          <div className="w-full md:w-72">
            <input
              type="search"
              placeholder="Search name, username, rep ID"
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
                  <th className="w-44 px-4 py-3 text-left font-semibold">Name</th>
                  <th className="w-44 px-4 py-3 text-left font-semibold">Username</th>
                  <th className="w-32 px-4 py-3 text-left font-semibold">OPPI</th>
                  <th className="w-36 px-4 py-3 text-left font-semibold">Team</th>
                  <th className="w-[360px] px-4 py-3 text-left font-semibold">Password Key</th>
                  <th className="w-44 px-4 py-3 text-left font-semibold">Issued</th>
                  <th className="w-32 px-4 py-3 text-right font-semibold">Options</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const id = getUserId(user);
                  const isVisible = visibleKeygens.has(id);
                  return (
                    <tr key={id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900 truncate">{user?.name || "-"}</td>
                      <td className="px-4 py-3 truncate">{getDisplayUsername(user) || "-"}</td>
                      <td className="px-4 py-3 truncate">{getDisplayRepId(user) || "-"}</td>
                      <td className="px-4 py-3 truncate">{getDisplayRole(user) || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-[360px]">
                          <span
                            className={`text-xs text-gray-600 font-mono ${
                              isVisible ? "break-all whitespace-normal" : "whitespace-nowrap"
                            }`}
                          >
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
                                {isVisible ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(user?.keygen)}
                                className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                aria-label="Copy keygen"
                              >
                                Copy
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatDate(user?.keygenIssuedAt || user?.createdAt)}</td>
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
