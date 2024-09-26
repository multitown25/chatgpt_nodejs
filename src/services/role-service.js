import Role from "../models/role-model.js";

class RoleService {

    async getRoleId(roleName) {
        try {
            const role = await Role.findOne({ name: roleName });
            if (role) {
                return role._id;
            } else {
                throw new Error('Role not found');
            }
        } catch (error) {
            console.error('Error fetching role:', error);
            throw error;
        }
    }
}

export default new RoleService();