export const API_BASE_URL = 'https://sheetdb.io/api/v1/jsrzvylcy75sj';

export const fetchSheetData = async (sheetName: string) => {
  const response = await fetch(`${API_BASE_URL}?sheet=${sheetName}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}`);
  }
  return response.json();
};

export const addRowToSheet = async (sheetName: string, data: any) => {
  const response = await fetch(`${API_BASE_URL}?sheet=${sheetName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data: [data] })
  });
  if (!response.ok) {
    throw new Error(`Failed to add row to ${sheetName}`);
  }
  return response.json();
};

export const updateRowInSheet = async (sheetName: string, idField: string, idValue: string, data: any) => {
  const response = await fetch(`${API_BASE_URL}/${idField}/${idValue}?sheet=${sheetName}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data })
  });
  if (!response.ok) {
    throw new Error(`Failed to update row in ${sheetName}`);
  }
  return response.json();
};

export const deleteRowFromSheet = async (sheetName: string, idField: string, idValue: string) => {
  const response = await fetch(`${API_BASE_URL}/${idField}/${idValue}?sheet=${sheetName}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Failed to delete row from ${sheetName}`);
  }
  return response.json();
};
