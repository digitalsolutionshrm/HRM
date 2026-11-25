import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional() @IsDateString() dateOfBirth?: string | null;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsEmail() personalEmail?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() husbandName?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsString() emergencyContactRelation?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
}
