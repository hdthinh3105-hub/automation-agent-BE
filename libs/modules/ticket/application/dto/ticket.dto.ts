import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@app/shared/dto/pagination.dto';

export class CreateTicketDto {
  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class AddCustomerMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateTicketStatusDto {
  @IsString()
  @IsIn([
    'NEW',
    'CLASSIFIED',
    'WAITING_CUSTOMER',
    'ANSWERED',
    'ESCALATED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
  ])
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListTicketsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() assignedAgentId?: string;
}

export class TicketResponseDto {
  id!: string;
  customerId!: string;
  channel!: string;
  subject!: string;
  status!: string;
  category!: string | null;
  priority!: string | null;
  assignedAgentId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class TicketMessageResponseDto {
  id!: string;
  ticketId!: string;
  sender!: string;
  content!: string;
  createdAt!: Date;
}

/**
 * TDD Mục 5.3 — Web Chat Widget cần đọc lại ticket (status + messages)
 * mà KHÔNG có JWT (khách hàng không đăng nhập). Dto này CHỈ trả field
 * an toàn để lộ ra ngoài (không có category/priority/confidenceScore/
 * assignedAgentId — thông tin nội bộ dành cho Agent).
 */
export class TicketPublicMessageDto {
  id!: string;
  sender!: string;
  content!: string;
  createdAt!: Date;
}

export class TicketPublicResponseDto {
  id!: string;
  subject!: string;
  status!: string;
  messages!: TicketPublicMessageDto[];
}
