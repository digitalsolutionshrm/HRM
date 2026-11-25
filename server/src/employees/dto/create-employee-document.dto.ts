import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEmployeeDocumentDto {
  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  documentName?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
