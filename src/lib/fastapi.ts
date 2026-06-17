// FastAPI Service Layer for SAP Business One Integration
// This service handles communication with the FastAPI middleware
import { apiService } from '../services/api';

export interface SapResponse {
  success: boolean;
  document_number?: string;
  response_code?: string;
  response_message?: string;
  error?: string;
}

export interface ApproveEventRequest {
  event_id: string;
  modified_quantity: number;
  notes?: string;
}

export interface RejectEventRequest {
  event_id: string;
  rejection_reason: string;
  notes?: string;
}

export interface UpdateEventRequest {
  event_id: string;
  production_order?: string;
  item_code?: string;
  bin_location?: string;
  quantity?: number;
  product?: string;
  warehouse?: string;
  notes?: string;
  of_numdoc?: string;
}

export interface ValidateEventResponse {
  status: "VALID" | "INVALID";
  errors: Array<{
    field: string;
    message: string;
    severity: string;
  }>;
}

class FastApiService {
  async getPendingEvents(): Promise<any[]> {
    try {
      return await apiService.get<any[]>('/events/pending');
    } catch (error) {
      console.error('Error fetching pending events:', error);
      throw error;
    }
  }

  async approveEvent(request: ApproveEventRequest): Promise<SapResponse> {
    try {
      return await apiService.patch<SapResponse>(`/events/${request.event_id}/approve`, {
        modified_quantity: request.modified_quantity,
        notes: request.notes,
      });
    } catch (error) {
      console.error('Error approving event:', error);
      throw error;
    }
  }

  async rejectEvent(request: RejectEventRequest): Promise<SapResponse> {
    try {
      return await apiService.patch<SapResponse>(`/events/${request.event_id}/reject`, {
        rejection_reason: request.rejection_reason,
        notes: request.notes,
      });
    } catch (error) {
      console.error('Error rejecting event:', error);
      throw error;
    }
  }

  async updateEvent(request: UpdateEventRequest): Promise<SapResponse> {
    try {
      return await apiService.patch<SapResponse>(`/events/${request.event_id}/update`, {
        production_order: request.production_order,
        of_numdoc: request.of_numdoc,
        bin_location: request.bin_location,
        quantity: request.quantity,
        product: request.product,
        warehouse: request.warehouse,
        notes: request.notes,
      });
    } catch (error: any) {
      // Normalize axios error into SapResponse so UI can show server-side details
      console.error('Error updating event:', error);
      const serverData = error?.response?.data;
      const message = serverData?.detail || serverData?.message || serverData?.error || error.message || 'Unknown error';
      return {
        success: false,
        error: String(message),
        response_code: error?.response?.status ? String(error.response.status) : undefined,
        response_message: serverData?.response_message || undefined,
      };
    }
  }

  async validateEvent(eventId: string): Promise<ValidateEventResponse> {
    try {
      return await apiService.post<ValidateEventResponse>(`/events/${eventId}/validate`, {});
    } catch (error) {
      console.error('Error validating event:', error);
      throw error;
    }
  }

  async getEventsMetadata(): Promise<{ event_types: string[]; products: string[] }> {
    try {
      return await apiService.get<{ event_types: string[]; products: string[] }>('/events/metadata');
    } catch (error) {
      console.error('Error fetching events metadata:', error);
      throw error;
    }
  }
}

export const fastApiService = new FastApiService();
