import Company from "../models/company-model.js";
import UserService from "./user-service.js";

class CompanyService {
    async getCompanyId(companyName) {
        try {
            const company = await Company.findOne({name: companyName});
            if (company) {
                return company._id;
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
            const user = await UserService.getUserByTgId(tgId);
            const company = await Company.findById(user.companyId);

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