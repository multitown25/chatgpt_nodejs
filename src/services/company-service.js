import Company from "../models/company-model.js";
import UserService from "./user-service.js";

class CompanyService {
    async getCompany(companyName) {
        try {
            const company = await Company.findOne({name: companyName});
            if (company) {
                return company;
            } else {
                throw new Error('Company not found');
            }
        } catch (error) {
            console.error('Error fetching company:', error);
            throw error;
        }
    }

    async getCompanyNameByUserTgId(tgId) {
        try {
            const user = await UserService.getUser({telegramId: tgId});
            const company = await Company.findById(user.company.id);

            if (company) {
                return company.name;
            } else {
                throw new Error('Company not found');
            }

        } catch (error) {
            console.error('Error fetching company:', error);
            throw error;
        }
    }
}

export default new CompanyService();