import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactController } from './contact.controller';
import { ContactInfo, ContactInfoSchema } from './schemas';
import { ContactService } from './contact.service';

@Module({
  imports: [MongooseModule.forFeature([
      { name: ContactInfo.name, schema: ContactInfoSchema },
    ])],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
