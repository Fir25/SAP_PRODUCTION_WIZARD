import axios, { AxiosInstance, AxiosError } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Create axios instance with base configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // You can add auth tokens here if needed
    // const token = localStorage.getItem('auth_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      
      switch (status) {
        case 401:
          console.error('Unauthorized access');
          // Redirect to login or refresh token
          break;
        case 403:
          console.error('Forbidden access');
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error(`API Error: ${status}`);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Network error - no response received');
    } else {
      // Error in request configuration
      console.error('Request configuration error');
    }
    
    return Promise.reject(error);
  }
);

// API Service Class
class ApiService {
  private client: AxiosInstance;

  constructor(axiosClient: AxiosInstance) {
    this.client = axiosClient;
  }

  // Generic GET request
  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  // Generic POST request
  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  // Generic PATCH request
  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  // Generic PUT request
  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  // Generic DELETE request
  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // Get the axios client for custom requests
  getClient(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiService = new ApiService(apiClient);

// Export the base URL for WebSocket connection
export const getWebSocketUrl = (): string => {
  const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = API_BASE_URL.replace(/^https?:\/\//, `${wsProtocol}://`);
  return `${wsUrl}/ws/events`;
};

// Export the base URL
export const API_URL = API_BASE_URL;
