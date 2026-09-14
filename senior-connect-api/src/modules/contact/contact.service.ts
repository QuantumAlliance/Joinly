import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ServiceResponse } from '../../common/interfaces/api-response.interface';
import { idOf } from '../../common/schema.helpers';
import { AdminContactInfo, ContactInfoItem } from './interfaces/contact.interface';
import { ContactInfo, ContactInfoDocument } from './schemas';
import { UpdateContactDto } from './dto';

/** Seeded on first read so the app always has something to show. */
const DEFAULT_CONTACT = {
  email: 'support@arooby.io',
  phoneNumber: '+654203540012',
};

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactInfo.name)
    private readonly contactModel: Model<ContactInfoDocument>,
  ) {}

  /** Mobile — "Contact Us" page (Email + Phone number). Public. */
  async getPublic(): Promise<ServiceResponse<ContactInfoItem>> {
    const contact = await this.getOrCreate();
    return {
      message: 'Contact information retrieved successfully',
      data: { email: contact.email, phoneNumber: contact.phoneNumber },
    };
  }

  /** Admin — full record for the dashboard editor. */
  async adminGet(): Promise<ServiceResponse<AdminContactInfo>> {
    return { message: 'Contact information retrieved successfully', data: await this.toAdmin() };
  }

  /** Admin — update Email and/or Phone number. */
  async update(dto: UpdateContactDto): Promise<ServiceResponse<AdminContactInfo>> {
    const contact = await this.getOrCreate();
    Object.assign(contact, dto);
    await contact.save();
    return { message: 'Contact information updated successfully', data: await this.toAdmin() };
  }

  private async toAdmin(): Promise<AdminContactInfo> {
    const contact = await this.getOrCreate();
    return {
      id: idOf(contact),
      email: contact.email,
      phoneNumber: contact.phoneNumber,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  /** The Contact Us page is a singleton — return the one document, creating it if missing. */
  private async getOrCreate(): Promise<ContactInfoDocument> {
    const existing = await this.contactModel.findOne().sort({ createdAt: 1 });
    return existing ?? this.contactModel.create(DEFAULT_CONTACT);
  }
}
