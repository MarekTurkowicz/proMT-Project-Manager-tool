import axios from "axios";

/**
 * Tworzymy JEDNĄ instancję Axiosa.
 * Dzięki temu centralnie ustawimy baseURL, nagłówki i interceptory (np. token).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  withCredentials: false, // jeśli użyjesz cookies/CSRF -> zmienimy na true
});

export default api;
