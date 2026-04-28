import * as XLSX from "xlsx";

export const USER_WORKBOOK_SHEET_NAME = "Users";

const USER_WORKBOOK_COLUMNS = [
  { key: "name", label: "Name", width: 28 },
  { key: "username", label: "Username", width: 20 },
  { key: "team", label: "Team", width: 20 },
  { key: "division", label: "Division", width: 18 },
  { key: "access", label: "Access", width: 18 },
  { key: "secretPassword", label: "Secret Password", width: 34 },
  { key: "manualPassword", label: "Manual Password (Yes/No)", width: 22 },
];

const buildUserSheetRows = (users = []) => {
  const rows = [USER_WORKBOOK_COLUMNS.map((column) => column.label)];

  for (const user of users) {
    rows.push(
      USER_WORKBOOK_COLUMNS.map((column) => {
        switch (column.key) {
          case "name":
            return user?.name || "";
          case "username":
            return user?.username || "";
          case "team":
            return user?.team || "";
          case "division":
            return user?.division || "";
          case "access":
            return user?.access || "";
          case "secretPassword":
            return user?.secretPassword || "";
          case "manualPassword":
            return user?.manualPassword || "";
          default:
            return "";
        }
      })
    );
  }

  return rows;
};

const buildUserSheet = (users = []) => {
  const userSheet = XLSX.utils.aoa_to_sheet(buildUserSheetRows(users));
  userSheet["!cols"] = USER_WORKBOOK_COLUMNS.map((column) => ({ wch: column.width }));
  return userSheet;
};

export const createUsersWorkbookBuffer = (users = []) => {
  const workbook = XLSX.utils.book_new();
  const userSheet = buildUserSheet(users);

  XLSX.utils.book_append_sheet(workbook, userSheet, USER_WORKBOOK_SHEET_NAME);

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

export const createUsersCsvBuffer = (users = []) => {
  const csv = XLSX.utils.sheet_to_csv(buildUserSheet(users));
  return Buffer.from(`\ufeff${csv}`, "utf8");
};
