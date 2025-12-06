import mailjet from "node-mailjet";
import { Logger } from "./logger.ts";

export interface IEmailOptions {
  to: string;
  subject: string;
  textContent: string;
  htmlContent: string;
}

export type EmailCategory = "interested" | "tester" | "adopter";

export class EmailService {
  private mailjetClient: mailjet.Client;
  private fromEmail: string;

  constructor() {
    const apiKey = Deno.env.get("MAILJET_API_KEY");
    const apiSecret = Deno.env.get("MAILJET_API_SECRET");
    this.fromEmail = Deno.env.get("MAILJET_FROM") || "";

    if (!apiKey || !apiSecret) {
      throw new Error("MAILJET_API_KEY and MAILJET_API_SECRET must be set in environment variables");
    }

    if (!this.fromEmail) {
      throw new Error("MAILJET_FROM must be set in environment variables");
    }

    this.mailjetClient = new mailjet.Client({
      apiKey: apiKey,
      apiSecret: apiSecret,
    });
  }

  public async sendEmail(options: IEmailOptions): Promise<void> {
    try {
      const request = this.mailjetClient
        .post("send", { version: "v3.1" })
        .request({
          Messages: [
            {
              From: {
                Email: this.fromEmail,
                Name: "VDNS Team",
              },
              To: [
                {
                  Email: options.to,
                },
              ],
              Subject: options.subject,
              TextPart: options.textContent,
              HTMLPart: options.htmlContent,
            },
          ],
        });

      await request;
    } catch (error) {
      Logger.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  }

  public async sendCategorizedEmail(
    email: string,
    category: EmailCategory,
    language: string
  ): Promise<void> {
    const emailContent = await this.getCategorizedEmailContent(category, language);

    await this.sendEmail({
      to: email,
      subject: emailContent.subject,
      textContent: emailContent.textContent,
      htmlContent: emailContent.htmlContent,
    });
  }

  private async getCategorizedEmailContent(
    category: EmailCategory,
    language: string
  ): Promise<{
    subject: string;
    textContent: string;
    htmlContent: string;
  }> {
    const templateMap: Record<EmailCategory, string> = {
      interested: "virtualdns-waitlist-confirmation.html",
      tester: "virtualdns-early-access-confirmation.html",
      adopter: "virtualdns-production-commitment.html",
    };

    const subjectMap: Record<EmailCategory, Record<string, string>> = {
      interested: {
        en: "Thank you for your interest in VirtualDNS!",
        es: "¡Gracias por tu interés en VirtualDNS!",
        pt: "Obrigado pelo seu interesse no VirtualDNS!",
      },
      tester: {
        en: "Thank you for wanting to try VirtualDNS!",
        es: "¡Gracias por querer probar VirtualDNS!",
        pt: "Obrigado por querer experimentar o VirtualDNS!",
      },
      adopter: {
        en: "Welcome to VirtualDNS VIP Early Adopters!",
        es: "¡Bienvenido a los Early Adopters VIP de VirtualDNS!",
        pt: "Bem-vindo aos Early Adopters VIP do VirtualDNS!",
      },
    };

    const textContentMap: Record<EmailCategory, Record<string, string>> = {
      interested: {
        en: "Thank you for your interest in VirtualDNS! You're on our waitlist to be one of the first to discover VirtualDNS when it's available.",
        es: "¡Gracias por tu interés en VirtualDNS! Estás en nuestra lista de espera para ser uno de los primeros en descubrir VirtualDNS cuando esté disponible.",
        pt: "Obrigado pelo seu interesse no VirtualDNS! Você está na nossa lista de espera para ser um dos primeiros a descobrir o VirtualDNS quando estiver disponível.",
      },
      tester: {
        en: "Thank you for wanting to try VirtualDNS! You've joined our priority waitlist for beta testers. You'll be contacted when the service is ready.",
        es: "¡Gracias por querer probar VirtualDNS! Te has unido a nuestra lista de espera prioritaria para probadores beta. Serás contactado cuando el servicio esté listo.",
        pt: "Obrigado por querer experimentar o VirtualDNS! Você entrou na nossa lista de espera prioritária para testadores beta. Você será contatado quando o serviço estiver pronto.",
      },
      adopter: {
        en: "Thank you for your commitment to VirtualDNS! You have been added to our VIP early adoption list with priority access, personalized support, and exclusive special conditions.",
        es: "¡Gracias por tu compromiso con VirtualDNS! Has sido agregado a nuestra lista VIP de adopción temprana con acceso prioritario, soporte personalizado y condiciones especiales exclusivas.",
        pt: "Obrigado pelo seu compromisso com o VirtualDNS! Você foi adicionado à nossa lista VIP de adoção antecipada com acesso prioritário, suporte personalizado e condições especiais exclusivas.",
      },
    };

    const templateFileName = templateMap[category];
    const normalizedLanguage = language.toLowerCase();
    const languageFolder = ["en", "es", "pt"].includes(normalizedLanguage) ? normalizedLanguage : "en";
    const templatePath = `./assets/${languageFolder}/${templateFileName}`;

    let htmlContent: string;

    try {
      htmlContent = await Deno.readTextFile(templatePath);
    } catch (error) {
      Logger.error(`Error reading template file: ${templatePath}`, error);
      throw new Error(`Failed to load email template for category: ${category}, language: ${language}`);
    }

    const subject = subjectMap[category][languageFolder] || subjectMap[category].en;
    const textContent = textContentMap[category][languageFolder] || textContentMap[category].en;

    return {
      subject,
      textContent,
      htmlContent,
    };
  }
}
