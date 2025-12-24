import axios from "axios";

const api = axios.create({
  baseURL: "https://automatic-certificate-generator-gcl0.onrender.com",
  timeout: 60000,
});

export default api;
